"use client";

import {
  Banknote,
  Briefcase,
  Building2,
  CalendarDays,
  CheckSquare,
  Cpu,
  Eye,
  Layers,
  MapPin,
  Plus,
  Radar,
  Search,
  Sparkles,
  Square,
  TrendingUp,
  Users,
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

type FilterField =
  | "keywords"
  | "company"
  | "industry"
  | "location"
  | "headcount"
  | "revenue"
  | "funding"
  | "technology"
  | "year_founded"
  | "intent"
  | "title"
  | "seniority"
  | "department";

type FilterDef = {
  field: FilterField;
  label: string;
  icon: typeof Search;
  placeholder: string;
  group: "company" | "contact";
};

// Lusha / Prospeo-style filter catalogue.
const FILTERS: FilterDef[] = [
  // Company
  { field: "company", label: "Nazwa firmy", icon: Building2, placeholder: "np. Allegro", group: "company" },
  { field: "location", label: "Lokalizacja (HQ)", icon: MapPin, placeholder: "np. Warszawa, Polska", group: "company" },
  { field: "industry", label: "Branża", icon: Layers, placeholder: "np. fintech, SaaS", group: "company" },
  { field: "headcount", label: "Liczba pracowników", icon: Users, placeholder: "np. 50-200", group: "company" },
  { field: "revenue", label: "Przychód", icon: TrendingUp, placeholder: "np. 10M-50M", group: "company" },
  { field: "funding", label: "Finansowanie", icon: Banknote, placeholder: "np. Series A, runda", group: "company" },
  { field: "technology", label: "Technologie", icon: Cpu, placeholder: "np. Salesforce, React", group: "company" },
  { field: "year_founded", label: "Rok założenia", icon: CalendarDays, placeholder: "np. 2015-2020", group: "company" },
  { field: "intent", label: "Sygnały intencji", icon: Radar, placeholder: "np. rekrutacja, ekspansja", group: "company" },
  { field: "keywords", label: "Słowa kluczowe", icon: Sparkles, placeholder: "dowolne słowa", group: "company" },
  // Contact
  { field: "title", label: "Stanowisko", icon: Briefcase, placeholder: "np. Head of Sales", group: "contact" },
  { field: "seniority", label: "Poziom (seniority)", icon: TrendingUp, placeholder: "np. C-level, Director", group: "contact" },
  { field: "department", label: "Dział", icon: Layers, placeholder: "np. Marketing, IT", group: "contact" },
];

// Which filters apply to which search kind.
const COMPANY_FIELDS: FilterField[] = [
  "company", "location", "industry", "headcount", "revenue", "funding",
  "technology", "year_founded", "intent", "keywords",
];
const CONTACT_FIELDS: FilterField[] = [
  "title", "seniority", "department", "company", "location", "industry",
  "technology", "keywords",
];

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
  const [values, setValues] = useState<Partial<Record<FilterField, string>>>({});
  const [active, setActive] = useState<FilterField[]>(
    defaultKind === "person" ? ["title"] : ["industry"],
  );
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ProspectCandidate[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

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

  const availableFields = kind === "person" ? CONTACT_FIELDS : COMPANY_FIELDS;
  const addableFilters = FILTERS.filter(
    (f) => availableFields.includes(f.field) && !active.includes(f.field),
  );

  function addFilter(field: FilterField) {
    setActive((a) => [...a, field]);
  }
  function removeFilter(field: FilterField) {
    setActive((a) => a.filter((f) => f !== field));
    setValues((v) => {
      const next = { ...v };
      delete next[field];
      return next;
    });
  }
  function setValue(field: FilterField, val: string) {
    setValues((v) => ({ ...v, [field]: val }));
  }

  function switchKind(k: EntityKind) {
    setKind(k);
    setCandidates([]);
    setActive(k === "person" ? ["title"] : ["industry"]);
    setValues({});
  }

  async function run() {
    setBusy(true);
    setMsg(null);
    setDone(null);
    setCandidates([]);
    setPicked(new Set());
    try {
      const req: ProspectSearchRequest = { kind, max_results: 30 };
      for (const f of active) {
        const val = (values[f] || "").trim();
        if (val) (req as Record<string, unknown>)[f] = val;
      }
      const r = await api.watchlists.search(req);
      setProvider(r.provider);
      setCandidates(r.candidates);
      if (r.candidates.length === 0) {
        setMsg("Brak wyników. Poluzuj filtry lub zmień słowa kluczowe.");
      } else {
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
          "Podepnij ją do źródła sygnałów (Źródła sygnałów → „Lista obserwowana”).",
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
      <div className="my-8 flex w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Search className="h-5 w-5 text-indigo-600" />
              Wyszukiwarka prospektów — własne kryteria
            </h3>
            <p className="text-xs text-gray-500">
              Buduj kryteria jak w Lusha / Prospeo. Silnik
              {provider ? ` (${provider})` : ""} — bez płatnego dostawcy danych;
              wyniki ładujesz do listy obserwowanej i śledzisz sygnałami.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-0 md:grid-cols-[300px_1fr]">
          {/* Filters column */}
          <div className="border-b border-gray-100 p-4 md:border-b-0 md:border-r">
            <div className="mb-3 flex gap-1 rounded-lg bg-gray-100 p-1">
              {(["company", "person"] as EntityKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => switchKind(k)}
                  className={
                    "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition " +
                    (kind === k
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700")
                  }
                >
                  {k === "company" ? "Firmy" : "Osoby"}
                </button>
              ))}
            </div>

            {/* Active filters */}
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Aktywne kryteria
            </p>
            <div className="space-y-2">
              {active.length === 0 && (
                <p className="text-xs text-gray-400">
                  Dodaj kryteria z listy poniżej.
                </p>
              )}
              {active.map((field) => {
                const def = FILTERS.find((f) => f.field === field)!;
                const Icon = def.icon;
                return (
                  <div key={field}>
                    <div className="mb-0.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
                        <Icon className="h-3.5 w-3.5 text-indigo-500" />
                        {def.label}
                      </span>
                      <button
                        onClick={() => removeFilter(field)}
                        className="text-gray-300 hover:text-red-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <input
                      autoFocus
                      value={values[field] || ""}
                      onChange={(e) => setValue(field, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") run();
                      }}
                      placeholder={def.placeholder}
                      className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm"
                    />
                  </div>
                );
              })}
            </div>

            {/* Add filters */}
            {addableFilters.length > 0 && (
              <>
                <p className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Dodaj kryterium
                </p>
                <div className="space-y-0.5">
                  {addableFilters.map((def) => {
                    const Icon = def.icon;
                    return (
                      <button
                        key={def.field}
                        onClick={() => addFilter(def.field)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-indigo-500" />
                          {def.label}
                        </span>
                        <Plus className="h-3.5 w-3.5 text-gray-400" />
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <button
              onClick={run}
              disabled={busy}
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Search className="h-4 w-4" /> {busy ? "Szukam…" : "Szukaj"}
            </button>
          </div>

          {/* Results column */}
          <div className="p-4">
            {msg && <p className="mb-2 text-sm text-gray-700">{msg}</p>}
            {done && (
              <p className="mb-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {done}
              </p>
            )}

            {candidates.length === 0 && !msg && !done && (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center text-sm text-gray-400">
                <Search className="mb-2 h-8 w-8 text-gray-300" />
                Ustaw kryteria po lewej i kliknij „Szukaj”.
              </div>
            )}

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
                <div className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
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

                {/* Target + load */}
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
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm sm:w-52"
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
    </div>
  );
}
