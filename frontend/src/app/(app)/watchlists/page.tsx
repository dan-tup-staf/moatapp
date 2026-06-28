"use client";

import {
  Building2,
  CheckSquare,
  Download,
  Eye,
  FileUp,
  Link2,
  Pencil,
  Plus,
  Search,
  Square,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  api,
  ApiError,
  EntityKind,
  ProspectCandidate,
  ProspectSearchRequest,
  Watchlist,
  WatchlistDetail,
  WatchlistEntity,
} from "@/lib/api-client";

type AddTab = "manual" | "csv" | "linkedin" | "search";

export default function WatchlistsPage() {
  const [lists, setLists] = useState<Watchlist[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshLists() {
    try {
      const rows = await api.watchlists.list();
      setLists(rows);
    } catch {
      setLists([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshLists();
  }, []);

  if (loading) {
    return <p className="text-sm text-gray-500">Ładowanie…</p>;
  }

  if (selectedId !== null) {
    return (
      <WatchlistDetailView
        watchlistId={selectedId}
        onBack={() => {
          setSelectedId(null);
          refreshLists();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Eye className="h-6 w-6 text-indigo-600" />
            Listy obserwowane
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Twórz listy firm i osób, które chcesz śledzić sygnałami. Wgraj bazę
            z CSV, wyszukaj prospektów filtrami (jak Lusha / Prospeo), wklej link
            do LinkedIn Search lub dodaj ręcznie — a potem podepnij listę do
            źródła sygnałów, by śledzić zdarzenia w tych firmach/osobach.
          </p>
        </div>
        <CreateListButton onCreated={(id) => setSelectedId(id)} />
      </div>

      {lists.length === 0 ? (
        <EmptyState onCreated={(id) => setSelectedId(id)} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((wl) => (
            <button
              key={wl.id}
              onClick={() => setSelectedId(wl.id)}
              className="rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="truncate font-semibold text-gray-900">
                  {wl.name}
                </h3>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
                  {wl.entities_count} poz.
                </span>
              </div>
              {wl.description && (
                <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                  {wl.description}
                </p>
              )}
              <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> {wl.companies_count} firm
                </span>
                <span className="inline-flex items-center gap-1">
                  <UserRound className="h-3.5 w-3.5" /> {wl.people_count} osób
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onCreated }: { onCreated: (id: number) => void }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
      <Eye className="mx-auto h-10 w-10 text-gray-300" />
      <h3 className="mt-3 font-semibold text-gray-900">
        Nie masz jeszcze żadnej listy obserwowanej
      </h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
        Zacznij od utworzenia listy firm lub osób. Potem wypełnij ją z CSV,
        wyszukiwarki prospektów albo ręcznie i podepnij do źródła sygnałów.
      </p>
      <div className="mt-4 flex justify-center">
        <CreateListButton onCreated={onCreated} />
      </div>
    </div>
  );
}

function CreateListButton({ onCreated }: { onCreated: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("company");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const wl = await api.watchlists.create({
        name: name.trim(),
        description: description.trim(),
        kind,
      });
      setOpen(false);
      setName("");
      setDescription("");
      onCreated(wl.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Błąd tworzenia");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        <Plus className="h-4 w-4" /> Nowa lista
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Nowa lista obserwowana</h3>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nazwa listy (np. Fintech Tier 1)"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Opis (opcjonalnie)"
            rows={2}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            {[
              { v: "company", label: "Firmy" },
              { v: "person", label: "Osoby" },
              { v: "mixed", label: "Mieszane" },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => setKind(o.v)}
                className={
                  "flex-1 rounded-md border px-3 py-2 text-sm " +
                  (kind === o.v
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50")
                }
              >
                {o.label}
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={submit}
            disabled={busy || !name.trim()}
            className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {busy ? "Tworzę…" : "Utwórz listę"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Detail view ----------------

function WatchlistDetailView({
  watchlistId,
  onBack,
}: {
  watchlistId: number;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<WatchlistDetail | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [addTab, setAddTab] = useState<AddTab>("search");
  const [filter, setFilter] = useState("");

  async function refresh() {
    try {
      const d = await api.watchlists.get(watchlistId);
      setDetail(d);
      setSelected(new Set());
    } catch {
      setDetail(null);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlistId]);

  const entities = detail?.entities ?? [];
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return entities;
    return entities.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.company || "").toLowerCase().includes(q) ||
        (e.domain || "").toLowerCase().includes(q) ||
        (e.title || "").toLowerCase().includes(q),
    );
  }, [entities, filter]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === filtered.length
        ? new Set()
        : new Set(filtered.map((e) => e.id)),
    );
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Usunąć ${selected.size} zaznaczonych pozycji?`)) return;
    await api.watchlists.bulkDelete(watchlistId, Array.from(selected));
    await refresh();
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-sm text-gray-500 hover:underline">
          ← Wróć do list
        </button>
        <p className="text-sm text-gray-500">Ładowanie…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm text-gray-500 hover:underline">
        ← Wróć do list obserwowanych
      </button>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {detail.name}
          </h1>
          {detail.description && (
            <p className="mt-1 text-sm text-gray-500">{detail.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" /> {detail.companies_count} firm
            </span>
            <span className="inline-flex items-center gap-1">
              <UserRound className="h-3.5 w-3.5" /> {detail.people_count} osób
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5">
              ID listy: {detail.id} — użyj go w źródle sygnałów
            </span>
          </div>
        </div>
      </div>

      {/* Add panel */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap gap-1 border-b border-gray-100 p-2">
          {(
            [
              { k: "search", label: "Wyszukaj prospektów", icon: Search },
              { k: "csv", label: "Import CSV", icon: FileUp },
              { k: "linkedin", label: "LinkedIn Search", icon: Link2 },
              { k: "manual", label: "Ręcznie", icon: Plus },
            ] as { k: AddTab; label: string; icon: typeof Search }[]
          ).map(({ k, label, icon: Icon }) => (
            <button
              key={k}
              onClick={() => setAddTab(k)}
              className={
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition " +
                (addTab === k
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100")
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        <div className="p-4">
          {addTab === "manual" && (
            <ManualAdd watchlistId={watchlistId} onAdded={refresh} />
          )}
          {addTab === "csv" && (
            <CsvImport watchlistId={watchlistId} onImported={refresh} />
          )}
          {addTab === "linkedin" && (
            <LinkedInImport
              watchlistId={watchlistId}
              sourceUrl={detail.source_url}
              onSaved={refresh}
            />
          )}
          {addTab === "search" && (
            <ProspectSearchPanel watchlistId={watchlistId} onAdded={refresh} />
          )}
        </div>
      </div>

      {/* Entities table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 p-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">
              Pozycje ({entities.length})
            </h3>
            {selected.size > 0 && (
              <button
                onClick={bulkDelete}
                className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
              >
                <Trash2 className="h-3.5 w-3.5" /> Usuń ({selected.size})
              </button>
            )}
          </div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtruj…"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>

        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">
            Brak pozycji. Dodaj firmy/osoby panelem powyżej.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="w-10 px-3 py-2">
                    <button onClick={toggleAll}>
                      {selected.size === filtered.length &&
                      filtered.length > 0 ? (
                        <CheckSquare className="h-4 w-4 text-gray-700" />
                      ) : (
                        <Square className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-2">Nazwa</th>
                  <th className="px-3 py-2">Firma / stanowisko</th>
                  <th className="px-3 py-2">Domena</th>
                  <th className="px-3 py-2">Lokalizacja</th>
                  <th className="w-20 px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <EntityRow
                    key={e.id}
                    watchlistId={watchlistId}
                    entity={e}
                    selected={selected.has(e.id)}
                    onToggle={() => toggle(e.id)}
                    onChanged={refresh}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function EntityRow({
  watchlistId,
  entity,
  selected,
  onToggle,
  onChanged,
}: {
  watchlistId: number;
  entity: WatchlistEntity;
  selected: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entity);

  async function save() {
    await api.watchlists.updateEntity(watchlistId, entity.id, {
      name: draft.name,
      company: draft.company,
      domain: draft.domain,
      title: draft.title,
      location: draft.location,
    });
    setEditing(false);
    onChanged();
  }

  async function remove() {
    await api.watchlists.deleteEntity(watchlistId, entity.id);
    onChanged();
  }

  if (editing) {
    return (
      <tr className="border-b border-gray-50 bg-amber-50/40">
        <td className="px-3 py-2"></td>
        <td className="px-2 py-1.5">
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </td>
        <td className="px-2 py-1.5">
          <input
            value={draft.company || ""}
            onChange={(e) => setDraft({ ...draft, company: e.target.value })}
            placeholder="firma"
            className="mb-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
          />
          <input
            value={draft.title || ""}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="stanowisko"
            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </td>
        <td className="px-2 py-1.5">
          <input
            value={draft.domain || ""}
            onChange={(e) => setDraft({ ...draft, domain: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </td>
        <td className="px-2 py-1.5">
          <input
            value={draft.location || ""}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </td>
        <td className="px-3 py-2">
          <div className="flex gap-1">
            <button
              onClick={save}
              className="rounded bg-gray-900 px-2 py-1 text-xs text-white"
            >
              Zapisz
            </button>
            <button
              onClick={() => {
                setDraft(entity);
                setEditing(false);
              }}
              className="rounded border border-gray-300 px-2 py-1 text-xs"
            >
              Anuluj
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50">
      <td className="px-3 py-2">
        <button onClick={onToggle}>
          {selected ? (
            <CheckSquare className="h-4 w-4 text-gray-700" />
          ) : (
            <Square className="h-4 w-4 text-gray-400" />
          )}
        </button>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5 font-medium text-gray-900">
          {entity.kind === "person" ? (
            <UserRound className="h-3.5 w-3.5 text-gray-400" />
          ) : (
            <Building2 className="h-3.5 w-3.5 text-gray-400" />
          )}
          {entity.linkedin_url ? (
            <a
              href={entity.linkedin_url}
              target="_blank"
              rel="noreferrer"
              className="hover:text-indigo-600 hover:underline"
            >
              {entity.name}
            </a>
          ) : (
            entity.name
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-gray-600">
        {entity.company || "—"}
        {entity.title && (
          <span className="block text-xs text-gray-400">{entity.title}</span>
        )}
      </td>
      <td className="px-3 py-2 text-gray-600">{entity.domain || "—"}</td>
      <td className="px-3 py-2 text-gray-600">{entity.location || "—"}</td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <button
            onClick={() => setEditing(true)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            title="Edytuj"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={remove}
            className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-600"
            title="Usuń"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ---------------- Manual add ----------------

function ManualAdd({
  watchlistId,
  onAdded,
}: {
  watchlistId: number;
  onAdded: () => void;
}) {
  const [kind, setKind] = useState<EntityKind>("company");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [domain, setDomain] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.watchlists.addEntities(watchlistId, [
        {
          kind,
          name: name.trim(),
          company: company.trim() || null,
          domain: domain.trim() || null,
          title: title.trim() || null,
        },
      ]);
      setName("");
      setCompany("");
      setDomain("");
      setTitle("");
      onAdded();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["company", "person"] as EntityKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={
              "rounded-md border px-3 py-1.5 text-sm " +
              (kind === k
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 text-gray-700 hover:bg-gray-50")
            }
          >
            {k === "company" ? "Firma" : "Osoba"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={kind === "person" ? "Imię i nazwisko" : "Nazwa firmy"}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        {kind === "person" && (
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Firma"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        )}
        {kind === "person" && (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Stanowisko"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        )}
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="Domena (np. acme.pl)"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <button
        onClick={add}
        disabled={busy || !name.trim()}
        className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        <Plus className="h-4 w-4" /> Dodaj
      </button>
    </div>
  );
}

// ---------------- CSV import ----------------

const CSV_TEMPLATE_COMPANY =
  "name,domain,industry,location,linkedin_url\n" +
  "Acme Sp. z o.o.,acme.pl,SaaS,Warszawa,https://www.linkedin.com/company/acme\n" +
  "Przykład S.A.,przyklad.pl,Fintech,Kraków,\n";

const CSV_TEMPLATE_PERSON =
  "name,company,title,domain,location,linkedin_url\n" +
  "Jan Kowalski,Acme Sp. z o.o.,Head of Sales,acme.pl,Warszawa,https://www.linkedin.com/in/jankowalski\n" +
  "Anna Nowak,Przykład S.A.,CMO,przyklad.pl,Kraków,\n";

function CsvImport({
  watchlistId,
  onImported,
}: {
  watchlistId: number;
  onImported: () => void;
}) {
  const [kind, setKind] = useState<EntityKind>("company");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function downloadTemplate() {
    const body = kind === "person" ? CSV_TEMPLATE_PERSON : CSV_TEMPLATE_COMPANY;
    const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `watchlist_${kind}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(file: File) {
    const t = await file.text();
    setText(t);
  }

  async function importNow() {
    if (!text.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await api.watchlists.importCsv(watchlistId, {
        kind,
        csv_text: text,
      });
      setResult(
        `Zaimportowano ${r.imported}, pominięto ${r.skipped}.` +
          (r.errors.length ? ` Błędy: ${r.errors.slice(0, 3).join("; ")}` : ""),
      );
      setText("");
      onImported();
    } catch (e) {
      setResult(e instanceof ApiError ? e.detail : "Błąd importu");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
        <p className="font-medium text-gray-800">Jak wgrać bazę:</p>
        <ol className="ml-4 mt-1 list-decimal space-y-0.5">
          <li>Pobierz szablon CSV i wypełnij go swoimi danymi (albo wklej własny).</li>
          <li>
            Kolumny: <code>name</code> (wymagane),{" "}
            <code>{kind === "person" ? "company, title, " : ""}domain</code>,{" "}
            <code>industry/location/linkedin_url</code> (opcjonalne).
            Akceptujemy też przecinek lub średnik jako separator.
          </li>
          <li>Wgraj plik lub wklej zawartość poniżej i kliknij „Importuj".</li>
        </ol>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(["company", "person"] as EntityKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={
              "rounded-md border px-3 py-1.5 text-sm " +
              (kind === k
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 text-gray-700 hover:bg-gray-50")
            }
          >
            {k === "company" ? "Firmy" : "Osoby"}
          </button>
        ))}
        <button
          onClick={downloadTemplate}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Download className="h-3.5 w-3.5" /> Pobierz szablon
        </button>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
          <FileUp className="h-3.5 w-3.5" /> Wgraj plik CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </label>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="…albo wklej tutaj zawartość CSV"
        className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs"
      />
      {result && <p className="text-sm text-gray-700">{result}</p>}
      <button
        onClick={importNow}
        disabled={busy || !text.trim()}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {busy ? "Importuję…" : "Importuj"}
      </button>
    </div>
  );
}

// ---------------- LinkedIn import ----------------

function LinkedInImport({
  watchlistId,
  sourceUrl,
  onSaved,
}: {
  watchlistId: number;
  sourceUrl: string | null;
  onSaved: () => void;
}) {
  const [url, setUrl] = useState(sourceUrl || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await api.watchlists.update(watchlistId, { source_url: url.trim() || null });
      setMsg("Zapisano link do LinkedIn Search dla tej listy.");
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
        <p className="font-medium text-gray-800">
          Lista z LinkedIn Sales Navigator / Search:
        </p>
        <ol className="ml-4 mt-1 list-decimal space-y-0.5">
          <li>
            W LinkedIn ustaw filtry wyszukiwania (branża, lokalizacja,
            stanowisko, wielkość firmy) i skopiuj URL wyników.
          </li>
          <li>Wklej go poniżej — zapiszemy go przy tej liście jako źródło.</li>
          <li>
            Import profili z LinkedIn działa przez podłączony silnik LinkedIn
            (zakładka LinkedIn → „Podłącz profil"). Do czasu podłączenia możesz
            dodać osoby przez „Wyszukaj prospektów" lub CSV.
          </li>
        </ol>
      </div>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://www.linkedin.com/search/results/people/?keywords=…"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {busy ? "Zapisuję…" : "Zapisz link"}
        </button>
        {url.trim() && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Link2 className="h-3.5 w-3.5" /> Otwórz w LinkedIn
          </a>
        )}
      </div>
    </div>
  );
}

// ---------------- Prospect search (Lusha / Prospeo-style) ----------------

function ProspectSearchPanel({
  watchlistId,
  onAdded,
}: {
  watchlistId: number;
  onAdded: () => void;
}) {
  const [kind, setKind] = useState<EntityKind>("company");
  const [form, setForm] = useState<ProspectSearchRequest>({
    kind: "company",
    keywords: "",
    industry: "",
    location: "",
    title: "",
    company: "",
    size: "",
    max_results: 20,
  });
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ProspectCandidate[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);

  function set<K extends keyof ProspectSearchRequest>(
    k: K,
    v: ProspectSearchRequest[K],
  ) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function run() {
    setBusy(true);
    setMsg(null);
    setCandidates([]);
    setPicked(new Set());
    try {
      const r = await api.watchlists.search({ ...form, kind });
      setProvider(r.provider);
      setCandidates(r.candidates);
      if (r.candidates.length === 0) {
        setMsg("Brak wyników. Spróbuj innych filtrów lub słów kluczowych.");
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

  async function addPicked() {
    const chosen = candidates.filter((_, i) => picked.has(i));
    if (chosen.length === 0) return;
    setBusy(true);
    try {
      await api.watchlists.addFromSearch(watchlistId, chosen);
      setMsg(`Dodano ${chosen.length} pozycji do listy.`);
      setCandidates((prev) => prev.filter((_, i) => !picked.has(i)));
      setPicked(new Set());
      onAdded();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-indigo-50/60 p-3 text-xs text-indigo-900">
        Wyszukaj firmy lub osoby filtrami (jak Lusha / Prospeo). Działa na
        aktywnym silniku wyszukiwania{provider ? ` (${provider})` : ""} — bez
        płatnego dostawcy danych. Zaznacz wyniki i dodaj je do listy.
      </div>
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
            {k === "company" ? "Szukaj firm" : "Szukaj osób"}
          </button>
        ))}
      </div>
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

      {candidates.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Znaleziono {candidates.length}. Zaznacz i dodaj do listy.
            </p>
            <button
              onClick={addPicked}
              disabled={busy || picked.size === 0}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              Dodaj zaznaczone ({picked.size})
            </button>
          </div>
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
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
                  {c.summary && (
                    <div className="mt-0.5 line-clamp-1 text-xs text-gray-400">
                      {c.summary}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
