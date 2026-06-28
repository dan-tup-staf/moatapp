"use client";

import {
  CheckSquare,
  Eye,
  Search,
  Square,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  api,
  ApiError,
  EntityKind,
  ProspectCandidate,
  ProspectSearchRequest,
  Watchlist,
} from "@/lib/api-client";

/** Button + modal that lets the user discover companies/people by filters
 * (Lusha / Prospeo-style) and load the selected results into a watchlist —
 * which can then be attached to a signal source. Mounted on the Firmy and
 * Osoby pages so discovery lives where the user looks for it. */
export function ProspectFinderButton({
  defaultKind,
}: {
  defaultKind: EntityKind;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        <Search className="h-4 w-4" />
        {defaultKind === "person"
          ? "Znajdź osoby (filtry)"
          : "Znajdź firmy (filtry)"}
      </button>
      {open && (
        <ProspectFinderModal
          defaultKind={defaultKind}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ProspectFinderModal({
  defaultKind,
  onClose,
}: {
  defaultKind: EntityKind;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<EntityKind>(defaultKind);
  const [form, setForm] = useState<ProspectSearchRequest>({
    kind: defaultKind,
    keywords: "",
    industry: "",
    location: "",
    title: "",
    company: "",
    size: "",
    max_results: 25,
  });
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ProspectCandidate[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Target watchlist
  const [lists, setLists] = useState<Watchlist[]>([]);
  const [targetId, setTargetId] = useState<number | "new">("new");
  const [newName, setNewName] = useState("");

  useEffect(() => {
    api.watchlists
      .list()
      .then((rows) => {
        setLists(rows);
        if (rows.length > 0) setTargetId(rows[0].id);
      })
      .catch(() => {});
  }, []);

  function set<K extends keyof ProspectSearchRequest>(
    k: K,
    v: ProspectSearchRequest[K],
  ) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function run() {
    setBusy(true);
    setMsg(null);
    setDone(null);
    setCandidates([]);
    setPicked(new Set());
    try {
      const r = await api.watchlists.search({ ...form, kind });
      setProvider(r.provider);
      setCandidates(r.candidates);
      if (r.candidates.length === 0) {
        setMsg("Brak wyników. Spróbuj innych filtrów lub słów kluczowych.");
      } else {
        // Pre-select everything — user can deselect.
        setPicked(new Set(r.candidates.map((_, i) => i)));
      }
    } catch (e) {
      setMsg(e instanceof ApiError ? e.detail : "Błąd wyszukiwania");
    } finally {
      setBusy(false);
    }
  }

  function togglePick(i: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function toggleAll() {
    setPicked((prev) =>
      prev.size === candidates.length
        ? new Set()
        : new Set(candidates.map((_, i) => i)),
    );
  }

  async function load() {
    const chosen = candidates.filter((_, i) => picked.has(i));
    if (chosen.length === 0) return;
    setBusy(true);
    setMsg(null);
    setDone(null);
    try {
      let wlId: number;
      let wlName: string;
      if (targetId === "new") {
        const name =
          newName.trim() ||
          `Wyszukiwanie ${kind === "person" ? "osób" : "firm"}`;
        const wl = await api.watchlists.create({
          name,
          kind,
          description: "Utworzona z wyszukiwarki prospektów",
        });
        wlId = wl.id;
        wlName = wl.name;
        setLists((prev) => [{ ...wl }, ...prev]);
        setTargetId(wl.id);
      } else {
        wlId = targetId;
        wlName = lists.find((l) => l.id === wlId)?.name || "lista";
      }
      await api.watchlists.addFromSearch(wlId, chosen);
      setDone(
        `Załadowano ${chosen.length} pozycji do listy „${wlName}”. ` +
          "Podepnij ją do źródła sygnałów (Źródła sygnałów → pole „Lista obserwowana”).",
      );
      setCandidates((prev) => prev.filter((_, i) => !picked.has(i)));
      setPicked(new Set());
    } catch (e) {
      setMsg(e instanceof ApiError ? e.detail : "Błąd ładowania do listy");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-3xl rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Search className="h-5 w-5 text-indigo-600" />
              {kind === "person" ? "Znajdź osoby" : "Znajdź firmy"} — filtry
            </h3>
            <p className="text-xs text-gray-500">
              Wyszukiwanie jak w Lusha / Prospeo. Działa na aktywnym silniku
              {provider ? ` (${provider})` : ""} — wyniki załadujesz do listy
              obserwowanej i podepniesz do śledzenia sygnałów.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Kind toggle */}
          <div className="flex gap-2">
            {(["company", "person"] as EntityKind[]).map((k) => (
              <button
                key={k}
                onClick={() => {
                  setKind(k);
                  setCandidates([]);
                }}
                className={
                  "rounded-md border px-3 py-1.5 text-sm " +
                  (kind === k
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50")
                }
              >
                {k === "company" ? "Firmy" : "Osoby"}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <input
              value={form.keywords || ""}
              onChange={(e) => set("keywords", e.target.value)}
              placeholder="Słowa kluczowe"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              value={form.industry || ""}
              onChange={(e) => set("industry", e.target.value)}
              placeholder="Branża (np. fintech)"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              value={form.location || ""}
              onChange={(e) => set("location", e.target.value)}
              placeholder="Lokalizacja (np. Warszawa)"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {kind === "person" && (
              <input
                value={form.title || ""}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Stanowisko (np. Head of Sales)"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            )}
            {kind === "person" && (
              <input
                value={form.company || ""}
                onChange={(e) => set("company", e.target.value)}
                placeholder="Firma (opcjonalnie)"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            )}
            {kind === "company" && (
              <input
                value={form.size || ""}
                onChange={(e) => set("size", e.target.value)}
                placeholder="Wielkość (np. 50-200)"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            )}
          </div>

          <button
            onClick={run}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Search className="h-4 w-4" /> {busy ? "Szukam…" : "Szukaj"}
          </button>

          {msg && <p className="text-sm text-gray-700">{msg}</p>}
          {done && (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {done}
            </p>
          )}

          {/* Results */}
          {candidates.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={toggleAll}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900"
                >
                  {picked.size === candidates.length ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  Zaznacz wszystko ({candidates.length})
                </button>
                <span className="text-xs text-gray-500">
                  zaznaczono {picked.size}
                </span>
              </div>
              <div className="max-h-64 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
                {candidates.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => togglePick(i)}
                    className={
                      "flex w-full items-start gap-3 px-3 py-2 text-left text-sm transition " +
                      (picked.has(i) ? "bg-indigo-50" : "hover:bg-gray-50")
                    }
                  >
                    {picked.has(i) ? (
                      <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                    ) : (
                      <Square className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-500">
                        {[c.title, c.company, c.domain, c.location]
                          .filter(Boolean)
                          .join(" · ") || c.source_url}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Target watchlist + load */}
              <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
                <label className="flex items-center gap-2 text-sm font-medium text-indigo-900">
                  <Eye className="h-4 w-4" /> Załaduj do listy obserwowanej
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <select
                    value={targetId}
                    onChange={(e) =>
                      setTargetId(
                        e.target.value === "new"
                          ? "new"
                          : Number(e.target.value),
                      )
                    }
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm sm:w-56"
                  >
                    <option value="new">+ Nowa lista…</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.entities_count})
                      </option>
                    ))}
                  </select>
                  {targetId === "new" && (
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Nazwa nowej listy"
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  )}
                  <button
                    onClick={load}
                    disabled={busy || picked.size === 0}
                    className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    Załaduj ({picked.size})
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
