"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  Building2,
  Clock,
  Database,
  FileSpreadsheet,
  Flame,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";

import {
  api,
  ApiError,
  CompanyRow,
  IcpFields,
  IcpProfile,
  IcpQA,
  LeadList,
  PersonRow,
  ScoringConfig,
  SignalSource,
  SourceType,
  SuggestedSource,
} from "@/lib/api-client";
import { ClientProfileSection } from "@/components/client-profile-editor";
import { ProspectFinderButton } from "@/components/prospect-finder";

const EMPTY_ICP_FIELDS: IcpFields = {
  target_industries: [],
  company_size: "",
  buyer_persona_titles: [],
  pain_points: [],
  triggers: [],
  notes: "",
  company: {
    employees: "",
    industry: "",
    recruitments_per_year: "",
    hr_employees: "",
  },
  personas: [],
};

// ---------- Listy panel ----------

export function ListsPanel() {
  const [lists, setLists] = useState<LeadList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setLists(await api.lists.list());
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd ładowania");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleDelete(id: number, name: string) {
    if (
      !window.confirm(`Usunąć listę "${name}" razem ze wszystkimi jej leadami?`)
    )
      return;
    try {
      await api.lists.delete(id);
      await refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Błąd usuwania");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {loading ? "" : `${lists.length} ${lists.length === 1 ? "lista" : "list"}`}
        </p>
        <div className="flex items-center gap-2">
          <ProspectFinderButton defaultKind="company" />
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" /> Dodaj prospektów
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Ładowanie...</p>
      ) : lists.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">
            Brak list prospektów
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Zaimportuj kontakty z CSV albo zbuduj listę z sygnałów.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" /> Dodaj prospektów
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((l) => (
            <div
              key={l.id}
              className="group relative rounded-xl border border-gray-200 bg-white p-4 transition hover:border-gray-400 hover:shadow-sm"
            >
              <button
                onClick={() => handleDelete(l.id, l.name)}
                className="absolute right-3 top-3 text-gray-300 opacity-0 transition hover:text-red-600 group-hover:opacity-100"
                title="Usuń listę"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <Link href={`/lists/${l.id}`} className="block">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900/[0.04]">
                  <Users className="h-4 w-4 text-gray-600" />
                </div>
                <p className="mt-3 truncate font-semibold text-gray-900 group-hover:underline">
                  {l.name}
                </p>
                {l.description && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">
                    {l.description}
                  </p>
                )}
                <p className="mt-3 text-xs text-gray-400">
                  <span className="font-medium text-gray-700">
                    {l.leads_count}
                  </span>{" "}
                  {l.leads_count === 1 ? "lead" : "leadów"} · utworzona{" "}
                  {new Date(l.created_at).toLocaleDateString("pl-PL")}
                </p>
              </Link>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddProspectsModal
          onClose={() => setShowAdd(false)}
          onDone={() => {
            setShowAdd(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

type AddTab = "csv" | "empty" | "integrations";

function AddProspectsModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [tab, setTab] = useState<AddTab>("csv");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">
            Dodaj prospektów
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-gray-200 px-5">
          {(
            [
              { key: "csv", label: "Import z CSV" },
              { key: "empty", label: "Pusta lista" },
              { key: "integrations", label: "Integracje" },
            ] as { key: AddTab; label: string }[]
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={
                "border-b-2 px-3 py-2.5 text-sm font-medium transition " +
                (tab === t.key
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-900")
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "csv" && <CsvImportTab onDone={onDone} />}
          {tab === "empty" && <EmptyListTab onDone={onDone} />}
          {tab === "integrations" && (
            <IntegrationsTab onPickCsv={() => setTab("csv")} />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyListTab({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.lists.create({ name, description: description || undefined });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd tworzenia");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-gray-500">
        Utwórz pustą listę i dodawaj do niej leady ręcznie lub z sygnałów.
      </p>
      <input
        type="text"
        required
        maxLength={255}
        placeholder="Nazwa listy *"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
      <input
        type="text"
        placeholder="Opis (opcjonalnie)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        disabled={saving}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? "Tworzenie…" : "Utwórz listę"}
      </button>
    </form>
  );
}

function CsvImportTab({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(
    null,
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const list = await api.lists.create({
        name: name || file.name.replace(/\.csv$/i, ""),
      });
      const r = await api.leads.importCsv(list.id, file);
      setResult({ imported: r.imported, skipped: r.skipped });
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd importu CSV");
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
        </div>
        <p className="text-sm font-medium text-gray-900">
          Zaimportowano {result.imported} leadów
          {result.skipped > 0 && (
            <span className="text-gray-500"> · pominięto {result.skipped}</span>
          )}
        </p>
        <button
          onClick={onDone}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Gotowe
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-gray-500">
        Wgraj plik CSV z kolumną{" "}
        <code className="rounded bg-gray-100 px-1">email</code> (wymagana) oraz
        opcjonalnie{" "}
        <code className="rounded bg-gray-100 px-1">first_name</code>,{" "}
        <code className="rounded bg-gray-100 px-1">last_name</code>,{" "}
        <code className="rounded bg-gray-100 px-1">company</code>,{" "}
        <code className="rounded bg-gray-100 px-1">title</code>. Rozpoznajemy też
        eksporty z Apollo / Lusha / Sales Navigator (nagłówki typu „Email”,
        „First Name”, „Company”) oraz separator przecinek lub średnik.
      </p>
      <input
        type="text"
        placeholder="Nazwa listy (domyślnie nazwa pliku)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center hover:border-gray-400">
        <Upload className="h-6 w-6 text-gray-400" />
        <span className="text-sm text-gray-600">
          {file ? (
            <span className="font-medium text-gray-900">{file.name}</span>
          ) : (
            "Kliknij, aby wybrać plik CSV"
          )}
        </span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="hidden"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        disabled={saving || !file}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? "Importuję…" : "Utwórz listę i importuj"}
      </button>
    </form>
  );
}

const INTEGRATIONS: { name: string; desc: string; icon: typeof Database }[] = [
  { name: "LinkedIn Search", desc: "Import z wyszukiwarki LinkedIn", icon: Users },
  { name: "Sales Navigator", desc: "Listy i leady z Sales Navigatora", icon: Users },
  { name: "LinkedIn Recruiter", desc: "Kandydaci z Recruitera", icon: Users },
  { name: "Reakcje pod postem", desc: "Osoby reagujące na post", icon: Users },
  { name: "HubSpot", desc: "Kontakty z HubSpot CRM", icon: Database },
  { name: "Salesforce", desc: "Leady z Salesforce", icon: Database },
];

function IntegrationsTab({ onPickCsv }: { onPickCsv: () => void }) {
  return (
    <div className="space-y-3">
      <button
        onClick={onPickCsv}
        className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-3 text-left transition hover:border-gray-900"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
          <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">Import z CSV</p>
          <p className="text-xs text-gray-500">Wgraj plik z leadami</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          Aktywne <ArrowRight className="h-3 w-3" />
        </span>
      </button>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {INTEGRATIONS.map((it) => (
          <div
            key={it.name}
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-3 opacity-90"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
              <it.icon className="h-5 w-5 text-gray-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-700">{it.name}</p>
              <p className="truncate text-xs text-gray-400">{it.desc}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
              <Clock className="h-3 w-3" /> wkrótce
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Firmy panel ----------

type SortCompanies = "score" | "leads" | "signals" | "recent";

// ---------- Tiering (Tier 1/2/3 + niekwalifikowane) ----------

type TierKey = "all" | "t1" | "t2" | "t3" | "nq";

function tierOf(
  score: number,
  t1 = 100,
  t2 = 20,
): Exclude<TierKey, "all"> {
  if (score > t1) return "t1";
  if (score > t2) return "t2";
  if (score > 0) return "t3";
  return "nq";
}

const TIERS: {
  key: Exclude<TierKey, "all">;
  label: string;
  sub: string;
  ring: string; // avatar / accent bg
  text: string;
  soft: string; // badge bg
  bar: string;
}[] = [
  {
    key: "t1",
    label: "Tier 1",
    sub: "Najgorętsze · score > 100",
    ring: "bg-rose-500",
    text: "text-rose-600",
    soft: "bg-rose-50 text-rose-700 border-rose-200",
    bar: "bg-rose-500",
  },
  {
    key: "t2",
    label: "Tier 2",
    sub: "Ciepłe · 21–100",
    ring: "bg-amber-500",
    text: "text-amber-600",
    soft: "bg-amber-50 text-amber-700 border-amber-200",
    bar: "bg-amber-500",
  },
  {
    key: "t3",
    label: "Tier 3",
    sub: "Letnie · 1–20",
    ring: "bg-sky-500",
    text: "text-sky-600",
    soft: "bg-sky-50 text-sky-700 border-sky-200",
    bar: "bg-sky-500",
  },
  {
    key: "nq",
    label: "Niekwalifikowane",
    sub: "Bez sygnału · 0",
    ring: "bg-gray-400",
    text: "text-gray-500",
    soft: "bg-gray-100 text-gray-600 border-gray-200",
    bar: "bg-gray-300",
  },
];

const TIER_META = Object.fromEntries(TIERS.map((t) => [t.key, t]));

function companyInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const ini = parts.map((w) => w[0]).slice(0, 2).join("");
  return ini.toUpperCase() || "?";
}

function ScoringConfigPanel({
  cfg,
  onSaved,
}: {
  cfg: ScoringConfig;
  onSaved: (c: ScoringConfig) => void;
}) {
  const [t1, setT1] = useState(cfg.tier1_min);
  const [t2, setT2] = useState(cfg.tier2_min);
  const [sources, setSources] = useState<SignalSource[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedWeight, setSavedWeight] = useState<number | null>(null);

  useEffect(() => {
    api.signalSources.list().then(setSources).catch(() => {});
  }, []);

  async function saveThresholds() {
    setErr(null);
    if (t2 >= t1) {
      setErr("Próg Tier 1 musi być wyższy niż Tier 2.");
      return;
    }
    setSaving(true);
    try {
      const c = await api.scoring.update({ tier1_min: t1, tier2_min: t2 });
      onSaved(c);
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : "Błąd zapisu");
    } finally {
      setSaving(false);
    }
  }

  async function saveWeight(id: number, weight: number) {
    try {
      await api.signalSources.update(id, { score_weight: weight });
      setSources((prev) =>
        prev.map((s) => (s.id === id ? { ...s, score_weight: weight } : s)),
      );
      setSavedWeight(id);
      setTimeout(() => setSavedWeight(null), 1200);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
          Konfiguracja scoringu
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          Jak liczymy score: każdy <strong>sygnał</strong> dopięty do osoby z
          firmy dodaje tej osobie tyle punktów, ile wynosi{" "}
          <strong>waga źródła sygnału</strong>. Score firmy = suma punktów jej
          osób. Próg decyduje, w którym tierze ląduje firma.
        </p>
      </div>

      {/* Tier thresholds */}
      <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Progi tierów
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-gray-600">
              Tier 1 gdy score &gt;
            </span>
            <input
              type="number"
              min={1}
              value={t1}
              onChange={(e) => setT1(Number(e.target.value))}
              className="w-28 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-gray-600">
              Tier 2 gdy score &gt;
            </span>
            <input
              type="number"
              min={1}
              value={t2}
              onChange={(e) => setT2(Number(e.target.value))}
              className="w-28 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </label>
          <p className="text-xs text-gray-400">
            Tier 3 = 1–{t2} · Niekwalifikowane = 0
          </p>
          <button
            onClick={saveThresholds}
            disabled={saving}
            className="ml-auto rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "Zapisuję…" : "Zapisz progi"}
          </button>
        </div>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      </div>

      {/* Source weights */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Wagi źródeł sygnałów (punkty za sygnał)
        </p>
        {sources.length === 0 ? (
          <p className="text-xs text-gray-400">
            Brak źródeł. Dodaj je w „Źródła sygnałów”, by zacząć punktować leady.
          </p>
        ) : (
          <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {sources.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">
                    {s.name}
                  </p>
                  <p className="text-[11px] text-gray-400">{s.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    defaultValue={s.score_weight}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== s.score_weight) saveWeight(s.id, v);
                    }}
                    className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
                  />
                  <span className="w-12 text-[11px] text-emerald-600">
                    {savedWeight === s.id ? "zapisano" : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-gray-400">
          Zmiana wagi działa na <em>nowo</em> wykrywane sygnały. Score już
          przyznany nie jest przeliczany wstecz.
        </p>
      </div>
    </div>
  );
}

export function CompaniesPanel() {
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortCompanies>("score");
  const [tier, setTier] = useState<TierKey>("all");
  const [query, setQuery] = useState("");
  const [cfg, setCfg] = useState<ScoringConfig>({ tier1_min: 100, tier2_min: 20 });
  const [showScoring, setShowScoring] = useState(false);

  useEffect(() => {
    api.scoring.get().then(setCfg).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setRows(await api.companies.list());
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : "Błąd ładowania");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const tierFor = (s: number) => tierOf(s, cfg.tier1_min, cfg.tier2_min);

  const counts = TIERS.reduce<Record<string, number>>(
    (acc, t) => {
      acc[t.key] = rows.filter((r) => tierFor(r.total_score) === t.key).length;
      return acc;
    },
    { all: rows.length },
  );

  const maxScore = Math.max(100, ...rows.map((r) => r.total_score));

  // Dynamic per-tier subtitle reflecting the user's thresholds.
  const tierSub: Record<string, string> = {
    t1: `Najgorętsze · score > ${cfg.tier1_min}`,
    t2: `Ciepłe · ${cfg.tier2_min + 1}–${cfg.tier1_min}`,
    t3: `Letnie · 1–${cfg.tier2_min}`,
    nq: "Bez sygnału · 0",
  };

  const filtered = rows.filter((r) => {
    if (tier !== "all" && tierFor(r.total_score) !== tier) return false;
    const q = query.trim().toLowerCase();
    if (q && !r.company.toLowerCase().includes(q)) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "score") return b.total_score - a.total_score;
    if (sort === "leads") return b.leads_count - a.leads_count;
    if (sort === "signals") return b.signals_count - a.signals_count;
    const aT = a.last_message_sent_at
      ? new Date(a.last_message_sent_at).getTime()
      : 0;
    const bT = b.last_message_sent_at
      ? new Date(b.last_message_sent_at).getTime()
      : 0;
    return bT - aT;
  });

  if (loading) return <p className="text-sm text-gray-500">Ładowanie...</p>;
  if (error)
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    );

  return (
    <div className="space-y-4">
      {/* Tier summary cards (clickable filters) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TIERS.map((t) => {
          const active = tier === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTier(active ? "all" : t.key)}
              className={
                "rounded-xl border bg-white p-4 text-left shadow-sm transition " +
                (active
                  ? "border-gray-900 ring-1 ring-gray-900"
                  : "border-gray-200 hover:border-gray-300")
              }
            >
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${t.ring}`} />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t.label}
                </span>
              </div>
              <p className={`mt-2 text-3xl font-bold ${t.text}`}>
                {counts[t.key] ?? 0}
              </p>
              <p className="mt-0.5 text-[11px] text-gray-400">
                {tierSub[t.key] ?? t.sub}
              </p>
            </button>
          );
        })}
      </div>

      {/* Scoring explainer + config toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3">
        <div className="flex items-start gap-2">
          <SlidersHorizontal className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
          <p className="text-xs text-indigo-900/80">
            <strong className="text-indigo-900">Scoring &amp; progi tierów.</strong>{" "}
            Tiery liczone z sumy score firmy (punkty z sygnałów dopiętych do jej
            osób). Aktualne progi: Tier 1 &gt; {cfg.tier1_min}, Tier 2 &gt;{" "}
            {cfg.tier2_min}. Ustaw własne progi i wagi źródeł →
          </p>
        </div>
        <button
          onClick={() => setShowScoring((s) => !s)}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {showScoring ? "Ukryj konfigurację scoringu" : "Konfiguruj scoring"}
        </button>
      </div>

      {showScoring && (
        <ScoringConfigPanel
          cfg={cfg}
          onSaved={(c) => {
            setCfg(c);
            setShowScoring(false);
          }}
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj firmy…"
            className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>
        <div className="flex items-center gap-3">
          {tier !== "all" && (
            <button
              onClick={() => setTier("all")}
              className="text-xs text-gray-500 underline hover:text-gray-900"
            >
              Wyczyść filtr
            </button>
          )}
          <FilterGroup
            label="Sort"
            value={sort}
            onChange={(v) => setSort(v as SortCompanies)}
            options={[
              { value: "score", label: "Score" },
              { value: "leads", label: "Osoby" },
              { value: "signals", label: "Sygnały" },
              { value: "recent", label: "Akt." },
            ]}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <Building2 className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">
            Brak firm — dodaj leadów z polem „firma" w sekcji Listy, a pojawią
            się tutaj pogrupowane na tiery.
          </p>
        </div>
      ) : sorted.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          Brak firm w tym tierze / dla tej frazy.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                  Firma
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                  Tier / Score
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                  Sygnały
                </th>
                <th className="px-4 py-2.5 text-center font-medium text-gray-600">
                  Osoby
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                  Status
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                  Ostatni mail
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((c) => {
                const tk = tierFor(c.total_score);
                const m = TIER_META[tk];
                const pct = Math.min(
                  100,
                  Math.round((c.total_score / maxScore) * 100),
                );
                return (
                  <tr key={c.company} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white ${m.ring}`}
                        >
                          {companyInitials(c.company)}
                        </div>
                        <span className="font-medium text-gray-900">
                          {c.company}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${m.soft}`}
                        >
                          {tk === "t1" && <Flame className="h-3 w-3" />}
                          {m.label}
                        </span>
                        <span className="font-mono text-xs font-semibold text-gray-700">
                          {c.total_score}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${m.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1 text-gray-700">
                        <Bell className="h-3.5 w-3.5 text-gray-400" />
                        {c.signals_count}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-gray-700">
                      {c.leads_count}
                      {c.active_enrollments > 0 && (
                        <span className="ml-1 text-[11px] text-emerald-600">
                          ({c.active_enrollments} aktywnych)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={c.highest_status} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">
                      {c.last_message_sent_at
                        ? new Date(c.last_message_sent_at).toLocaleDateString(
                            "pl-PL",
                          )
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- Osoby panel ----------

type SortPeople = "score" | "recent" | "name" | "signals";

const PEOPLE_PAGE = 200;

export function PeoplePanel() {
  const [rows, setRows] = useState<PersonRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortPeople>("score");
  const [query, setQuery] = useState("");
  const [cfg, setCfg] = useState<ScoringConfig>({ tier1_min: 100, tier2_min: 20 });

  useEffect(() => {
    api.scoring.get().then(setCfg).catch(() => {});
  }, []);

  function describeError(err: unknown): string {
    return err instanceof ApiError
      ? `Błąd ${err.status}: ${err.detail}`
      : `Błąd ładowania: ${err instanceof Error ? err.message : String(err)}`;
  }

  async function load(q: string, offset: number, append: boolean) {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const items = await api.people.list({ limit: PEOPLE_PAGE, offset, q });
      setRows((prev) => (append ? [...prev, ...items] : items));
      // Total is a separate, cheap call (best-effort; falls back to length).
      try {
        const { total } = await api.people.count(q);
        setTotal(total);
      } catch {
        setTotal(offset + items.length);
      }
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  // Initial load + debounced server-side search on query change.
  useEffect(() => {
    const t = setTimeout(() => load(query, 0, false), query ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Sort only the loaded page client-side.
  const sorted = [...rows].sort((a, b) => {
    if (sort === "score") return b.score - a.score;
    if (sort === "signals") return b.signals_count - a.signals_count;
    if (sort === "name") {
      const an = `${a.last_name ?? ""} ${a.first_name ?? ""}`.trim() || a.email;
      const bn = `${b.last_name ?? ""} ${b.first_name ?? ""}`.trim() || b.email;
      return an.localeCompare(bn, "pl");
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  const hasMore = rows.length < total;

  if (loading) return <p className="text-sm text-gray-500">Ładowanie...</p>;
  if (error)
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Szukaj: email, imię, firma, stanowisko…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-gray-500">
            {rows.length} z {total}
          </p>
          <FilterGroup
            label="Sort"
            value={sort}
            onChange={(v) => setSort(v as SortPeople)}
            options={[
              { value: "score", label: "Score" },
              { value: "recent", label: "Dodane" },
              { value: "name", label: "Nazwisko" },
              { value: "signals", label: "Sygnały" },
            ]}
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <Users className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">
            {query.trim()
              ? "Brak wyników dla wyszukiwania."
              : "Brak osób — dodaj leadów do listy w sekcji Listy."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                  Osoba
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                  Firma / stanowisko
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                  Tier / Score
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                  Lista
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                  Status
                </th>
                <th className="px-4 py-2.5 text-center font-medium text-gray-600">
                  Sygnały
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((p, i) => {
                const tk = tierOf(p.score, cfg.tier1_min, cfg.tier2_min);
                const m = TIER_META[tk];
                const name =
                  [p.first_name, p.last_name].filter(Boolean).join(" ") ||
                  p.email;
                const ini =
                  (
                    (p.first_name?.[0] ?? "") + (p.last_name?.[0] ?? "")
                  ).toUpperCase() ||
                  p.email[0]?.toUpperCase() ||
                  "?";
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
                            AVATARS[i % AVATARS.length]
                          }`}
                        >
                          {ini}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-gray-900">
                            {name}
                          </div>
                          <div className="truncate text-xs text-gray-500">
                            {p.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-gray-900">{p.company ?? "—"}</div>
                      {p.title && (
                        <div className="text-xs text-gray-500">{p.title}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${m.soft}`}
                        >
                          {tk === "t1" && <Flame className="h-3 w-3" />}
                          {m.label}
                        </span>
                        <span className="font-mono text-xs font-semibold text-gray-700">
                          {p.score}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      <Link
                        href={`/lists/${p.list_id}`}
                        className="hover:underline"
                      >
                        {p.list_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="inline-flex items-center gap-1 text-gray-700">
                        <Bell className="h-3.5 w-3.5 text-gray-400" />
                        {p.signals_count}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {hasMore && (
            <div className="border-t border-gray-100 p-3 text-center">
              <button
                onClick={() => load(query, rows.length, true)}
                disabled={loadingMore}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {loadingMore
                  ? "Ładuję…"
                  : `Pokaż więcej (${total - rows.length})`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const AVATARS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-sky-500",
];

// ---------- ICP panel ----------

export function IcpPanel() {
  const [icp, setIcp] = useState<IcpProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [url, setUrl] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [useManual, setUseManual] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [qa, setQa] = useState<IcpQA[]>([]);
  const [synthesizing, setSynthesizing] = useState(false);

  const [saving, setSaving] = useState(false);
  const [manualCreate, setManualCreate] = useState(false);
  // Force-show the AI (URL/manual) analyze form even when a profile exists.
  const [showAi, setShowAi] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.icp.get();
        setIcp(data);
        if (data?.qa_history?.length) setQa(data.qa_history);
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : "Błąd");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleAnalyze(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAnalyzing(true);
    try {
      const payload = useManual
        ? { manual_description: manualDescription }
        : { url };
      const res = await api.icp.analyzeUrl(payload);
      const newQa = res.suggested_questions.map((q) => ({
        question: q,
        answer: "",
      }));
      setQa(newQa);
      const fresh = await api.icp.get();
      setIcp(fresh);
      setShowAi(false);
      setManualCreate(false);
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.detail
        : `Nie udało się połączyć z API (możliwe uśpienie serwera lub przekroczony czas — analiza AI bywa wolna; spróbuj jeszcze raz za chwilę). Szczegóły: ${
            err instanceof Error ? err.message : String(err)
          }`;
      setError(msg);
      // 400 = scraping failed → automatycznie zasugeruj ręczny opis
      if (
        err instanceof ApiError &&
        err.status === 400 &&
        !useManual &&
        msg.includes("pobrać")
      ) {
        setUseManual(true);
      }
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSynthesize() {
    setError(null);
    setSynthesizing(true);
    try {
      const fresh = await api.icp.synthesize(qa);
      setIcp(fresh);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd syntezy");
    } finally {
      setSynthesizing(false);
    }
  }

  async function handleSaveFields(patch: Record<string, unknown>) {
    setSaving(true);
    try {
      const fresh = await api.icp.updateFields(patch);
      setIcp(fresh);
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Błąd");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!window.confirm("Wyczyścić cały ICP i zacząć od zera?")) return;
    await api.icp.delete();
    setIcp(null);
    setQa([]);
    setUrl("");
  }

  if (loading) return <p className="text-sm text-gray-500">Ładowanie...</p>;

  const hasScraped = !!icp?.scraped_summary;
  const hasIcp =
    icp?.icp_fields &&
    (icp.icp_fields.target_industries.length > 0 ||
      icp.icp_fields.buyer_persona_titles.length > 0 ||
      icp.icp_fields.company_size);
  const co = icp?.icp_fields?.company;
  const hasRichProfile =
    !!icp?.icp_fields &&
    (((icp.icp_fields.personas ?? []).length > 0) ||
      (!!co &&
        !!(
          co.employees ||
          co.industry ||
          co.recruitments_per_year ||
          co.hr_employees
        )));
  // Show the profile workspace (rich editor + flat ICP editor) whenever there
  // is any synthesized/manual data, or the user chose to create one by hand.
  const showProfile = !!hasIcp || hasRichProfile || manualCreate;

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {showProfile && !showAi ? (
        // Stage 3 / profile workspace: editable client profile + (when an AI
        // ICP exists) the flat ICP editor + signal discovery.
        <>
          <div className="flex justify-end">
            <button
              onClick={() => setShowAi(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Wygeneruj profil z adresu www (AI)
            </button>
          </div>
          <ClientProfileSection
            fields={icp?.icp_fields ?? EMPTY_ICP_FIELDS}
            saving={saving}
            onSave={handleSaveFields}
            initialEditing={manualCreate && !hasRichProfile}
          />
          {(hasIcp || hasScraped) && (
            <>
              <IcpEditor
                icp={icp!}
                saving={saving}
                onSave={handleSaveFields}
                onReset={handleReset}
                onRegenerate={handleSynthesize}
                regenerating={synthesizing}
                qa={qa}
              />
              <DiscoveryPanel />
            </>
          )}
        </>
      ) : showAi || !hasScraped ? (
        // Stage 1: Empty — URL / manual description / build profile by hand
        <>
        {showAi && (showProfile || hasScraped) && (
          <button
            onClick={() => setShowAi(false)}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← Wróć do profilu
          </button>
        )}
        <form
          onSubmit={handleAnalyze}
          className="space-y-3 rounded-lg border border-gray-200 bg-white p-6"
        >
          <h3 className="text-sm font-medium text-gray-700">
            Krok 1/3 — Powiedz o swojej firmie
          </h3>

          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setUseManual(false)}
              className={
                "rounded-full px-3 py-1 transition " +
                (useManual
                  ? "text-gray-600 hover:text-gray-900"
                  : "bg-gray-900 text-white")
              }
            >
              Link do strony
            </button>
            <button
              type="button"
              onClick={() => setUseManual(true)}
              className={
                "rounded-full px-3 py-1 transition " +
                (useManual
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:text-gray-900")
              }
            >
              Opis ręczny
            </button>
          </div>

          {useManual ? (
            <>
              <p className="text-xs text-gray-500">
                Użyj dla firm niewidocznych w internecie albo gdy LLM research
                nie znalazł informacji. Opisz firmę w 3-6 zdaniach — co
                robicie, komu sprzedajecie, czym się wyróżniacie.
              </p>
              <textarea
                required
                rows={6}
                placeholder="Np. Staffly to platforma do testów rekrutacyjnych dla zespołów HR w średnich firmach..."
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                Podaj link — AI przeszuka internet (strona, LinkedIn, news,
                katalogi) i zbierze info o firmie. Jeśli firma jest niewidoczna
                / AI nie znajdzie — przełącz na „Opis ręczny".
              </p>
              <input
                type="url"
                required
                placeholder="https://twoja-firma.pl"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </>
          )}

          <button
            type="submit"
            disabled={
              analyzing ||
              (useManual
                ? manualDescription.trim().length < 20
                : !url.trim())
            }
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {analyzing ? "Analizuję..." : "Analizuj"}
          </button>
        </form>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="h-px flex-1 bg-gray-200" />
          albo
          <div className="h-px flex-1 bg-gray-200" />
        </div>
        <button
          onClick={() => {
            setManualCreate(true);
            setShowAi(false);
          }}
          className="w-full rounded-lg border border-dashed border-gray-300 bg-white px-4 py-4 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50"
        >
          Stwórz profil klienta ręcznie — bez analizy AI →
        </button>
        </>
      ) : (
        // Stage 2: Questions
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-600">
            <p className="mb-1 font-medium text-gray-700">
              Krok 2/3 — odpowiedz na pytania
            </p>
            <p>
              Strona:{" "}
              <a
                href={icp!.source_url!}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {icp!.source_url}
              </a>
            </p>
          </div>

          <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
            {qa.map((pair, i) => (
              <div key={i}>
                <p className="mb-1 text-sm font-medium text-gray-800">
                  {i + 1}. {pair.question}
                </p>
                <textarea
                  value={pair.answer}
                  onChange={(e) => {
                    const next = [...qa];
                    next[i] = { ...next[i], answer: e.target.value };
                    setQa(next);
                  }}
                  rows={3}
                  placeholder="Odpowiedz własnymi słowami..."
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSynthesize}
              disabled={
                synthesizing ||
                qa.every((p) => !p.answer.trim())
              }
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {synthesizing ? "Syntezuję..." : "Wygeneruj ICP →"}
            </button>
            <button
              onClick={handleReset}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-100"
            >
              Zacznij od nowa
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Discovery: dedicated signal sources from ICP ----------

const CHANNEL_LABELS: Record<SourceType, string> = {
  rss: "RSS",
  pracuj_pl: "pracuj.pl",
  linkedin: "LinkedIn",
  google_news: "Google News",
  x_twitter: "X / Twitter",
  serp: "SERP",
  funding: "Bazy fundingowe",
  company_site: "Strona firmowa",
};

function DiscoveryPanel() {
  const [suggestions, setSuggestions] = useState<SuggestedSource[] | null>(
    null,
  );
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setDoneMsg(null);
    try {
      const res = await api.icp.suggestSources();
      setSuggestions(res.sources);
      // pre-select all by default
      setSelected(new Set(res.sources.map((_, i) => i)));
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd generowania");
    } finally {
      setLoading(false);
    }
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function activate() {
    if (!suggestions) return;
    const chosen = suggestions.filter((_, i) => selected.has(i));
    if (chosen.length === 0) return;
    setActivating(true);
    setError(null);
    try {
      await api.signalSources.createBatch(
        chosen.map((s) => ({
          name: s.name,
          type: s.type,
          config: { query: s.query, max_results: s.max_results },
          score_weight: s.score_weight,
        })),
      );
      setDoneMsg(
        `Aktywowano ${chosen.length} dedykowanych źródeł sygnałów. Zobacz sekcję „Źródła sygnałów".`,
      );
      setSuggestions(null);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd aktywacji");
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Dedykowane źródła sygnałów
          </h3>
          <p className="mt-0.5 text-xs text-gray-600">
            Na podstawie Twojego ICP wygenerujemy gotowe zapytania per kanał
            (LinkedIn, Google News, SERP, funding…). Przejrzyj, odznacz zbędne i
            aktywuj — worker zacznie zbierać sygnały dopasowane do tej firmy.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="shrink-0 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading
            ? "Generuję…"
            : suggestions
              ? "Przegeneruj"
              : "Wygeneruj plan sygnałów"}
        </button>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {doneMsg && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {doneMsg}
        </p>
      )}

      {suggestions && suggestions.length === 0 && (
        <p className="text-sm text-gray-500">
          Brak propozycji — uzupełnij ICP (branże, triggery) i spróbuj ponownie.
        </p>
      )}

      {suggestions && suggestions.length > 0 && (
        <>
          <div className="space-y-2">
            {suggestions.map((s, i) => {
              const checked = selected.has(i);
              return (
                <label
                  key={i}
                  className={
                    "flex cursor-pointer gap-3 rounded-lg border p-3 transition " +
                    (checked
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-200 hover:border-gray-300")
                  }
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(i)}
                    className="mt-1 h-4 w-4"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {s.name}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                        {CHANNEL_LABELS[s.type] ?? s.type}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        w:{s.score_weight}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-gray-500">
                      {s.query}
                    </p>
                    {s.rationale && (
                      <p className="mt-0.5 text-xs text-gray-600">
                        {s.rationale}
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
          <button
            onClick={activate}
            disabled={activating || selected.size === 0}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {activating
              ? "Aktywuję…"
              : `Aktywuj wybrane źródła (${selected.size})`}
          </button>
        </>
      )}
    </div>
  );
}

function IcpEditor({
  icp,
  saving,
  onSave,
  onReset,
  onRegenerate,
  regenerating,
  qa,
}: {
  icp: IcpProfile;
  saving: boolean;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
  onReset: () => Promise<void>;
  onRegenerate: () => Promise<void>;
  regenerating: boolean;
  qa: IcpQA[];
}) {
  const f = icp.icp_fields;
  const [industries, setIndustries] = useState(f.target_industries.join(", "));
  const [companySize, setCompanySize] = useState(f.company_size);
  const [buyerTitles, setBuyerTitles] = useState(
    f.buyer_persona_titles.join(", "),
  );
  const [painPoints, setPainPoints] = useState(f.pain_points.join("\n"));
  const [triggers, setTriggers] = useState(f.triggers.join("\n"));
  const [notes, setNotes] = useState(f.notes);

  const [showQa, setShowQa] = useState(false);

  function splitCsv(s: string): string[] {
    return s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
  function splitLines(s: string): string[] {
    return s
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  async function handleSave() {
    await onSave({
      target_industries: splitCsv(industries),
      company_size: companySize,
      buyer_persona_titles: splitCsv(buyerTitles),
      pain_points: splitLines(painPoints),
      triggers: splitLines(triggers),
      notes,
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
        <p className="font-medium">✓ Krok 3/3 — ICP wygenerowane</p>
        <p className="mt-1">
          Edytuj dowolne pole, kliknij „Zapisz". Możesz też przegenerować
          syntezę z nowymi odpowiedziami.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        <Field
          label="Target branże (przecinek)"
          value={industries}
          onChange={setIndustries}
        />
        <Field
          label="Wielkość firmy"
          value={companySize}
          onChange={setCompanySize}
          placeholder="np. 50-500 pracowników"
        />
        <Field
          label="Buyer persona — stanowiska (przecinek)"
          value={buyerTitles}
          onChange={setBuyerTitles}
        />
        <FieldArea
          label="Pain points (każdy w nowej linii)"
          value={painPoints}
          onChange={setPainPoints}
          rows={4}
        />
        <FieldArea
          label="Triggery kupowe (sygnały — każdy w nowej linii)"
          value={triggers}
          onChange={setTriggers}
          rows={4}
        />
        <FieldArea
          label="Dodatkowe notatki"
          value={notes}
          onChange={setNotes}
          rows={3}
        />

        <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "Zapisuję..." : "Zapisz zmiany"}
          </button>
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
          >
            {regenerating ? "Generuję..." : "Przegeneruj z LLM"}
          </button>
          <button
            onClick={() => setShowQa(!showQa)}
            className="ml-auto text-xs text-gray-500 hover:text-gray-900 underline"
          >
            {showQa ? "Ukryj" : "Pokaż"} pytania/odpowiedzi
          </button>
          <button
            onClick={onReset}
            className="text-xs text-red-600 hover:underline"
          >
            Reset całego ICP
          </button>
        </div>
      </div>

      {showQa && (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
          {qa.map((p, i) => (
            <div key={i}>
              <p className="text-xs font-medium text-gray-700">
                {i + 1}. {p.question}
              </p>
              <p className="mt-0.5 text-sm text-gray-900 whitespace-pre-wrap">
                {p.answer || <span className="text-gray-400">—</span>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </div>
  );
}

function FieldArea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </div>
  );
}

// ---------- Shared small components ----------

const STATUS_COLORS: Record<string, string> = {
  new: "bg-gray-100 text-gray-700",
  contacted: "bg-blue-100 text-blue-800",
  replied: "bg-emerald-100 text-emerald-800",
  bounced: "bg-red-100 text-red-800",
  unsubscribed: "bg-yellow-100 text-yellow-800",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{status}</span>
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase text-gray-500">
        {label}
      </span>
      <div className="flex rounded-md border border-gray-300 text-xs">
        {options.map((opt, i) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={
              "px-2.5 py-1 transition " +
              (value === opt.value
                ? "bg-gray-900 text-white"
                : "text-gray-700 hover:bg-gray-100") +
              (i > 0 ? " border-l border-gray-300" : "")
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
