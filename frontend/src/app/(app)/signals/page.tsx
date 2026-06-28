"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Bell,
  Briefcase,
  Building2,
  Globe,
  type LucideIcon,
  MessageCircle,
  Newspaper,
  Rss,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";

import {
  api,
  ApiError,
  Campaign,
  Signal,
  SignalSummary,
  SourceType,
} from "@/lib/api-client";

type FeedMode = null | "all" | "companies" | "linked";

const TYPE_LABELS: Record<SourceType, string> = {
  rss: "RSS",
  pracuj_pl: "pracuj.pl",
  linkedin: "LinkedIn",
  google_news: "Google News",
  x_twitter: "X / Twitter",
  serp: "SERP",
  funding: "Bazy fundingowe",
  company_site: "Strona firmowa",
};

const TYPE_ICONS: Record<SourceType, LucideIcon> = {
  rss: Rss,
  pracuj_pl: Briefcase,
  linkedin: Users,
  google_news: Newspaper,
  x_twitter: MessageCircle,
  serp: Search,
  funding: Banknote,
  company_site: Globe,
};

const TYPE_ACCENTS: Record<SourceType, string> = {
  rss: "bg-orange-100 text-orange-700",
  pracuj_pl: "bg-indigo-100 text-indigo-700",
  linkedin: "bg-blue-100 text-blue-700",
  google_news: "bg-rose-100 text-rose-700",
  x_twitter: "bg-sky-100 text-sky-700",
  serp: "bg-emerald-100 text-emerald-700",
  funding: "bg-violet-100 text-violet-700",
  company_site: "bg-gray-100 text-gray-700",
};

type StrengthFilter = "all" | "strong" | "medium" | "weak";
type TimeFilter =
  | "all"
  | "today"
  | "7d"
  | "30d"
  | "90d"
  | "custom";
type TypeFilter = "all" | SourceType;

const TIME_LABELS: Record<TimeFilter, string> = {
  all: "Wszystkie",
  today: "Dzisiaj",
  "7d": "7 dni",
  "30d": "30 dni",
  "90d": "90 dni",
  custom: "Zakres…",
};

const STRENGTH_LABELS: Record<StrengthFilter, string> = {
  all: "Wszystkie",
  strong: "Mocne (≥4)",
  medium: "Średnie (2-3)",
  weak: "Słabe (≤1)",
};

function daysCutoffMs(filter: TimeFilter): number | null {
  const DAY = 1000 * 60 * 60 * 24;
  if (filter === "today") return DAY;
  if (filter === "7d") return DAY * 7;
  if (filter === "30d") return DAY * 30;
  if (filter === "90d") return DAY * 90;
  return null;
}

/** Siła sygnału 0-5 — średnia z trzech wskaźników:
 *  - freshness: jak niedawno przyszedł ostatni sygnał
 *  - hit rate: jaki % sygnałów zlinkował się z leadem
 *  - impact:    sum of score_weight z zlinkowanych sygnałów
 */
function computeStrength(s: SignalSummary): number {
  if (s.signals_count === 0) return 0;

  const daysAgo = s.latest_signal_at
    ? (Date.now() - new Date(s.latest_signal_at).getTime()) /
      (1000 * 60 * 60 * 24)
    : 999;
  const fresh =
    daysAgo < 1 ? 5 : daysAgo < 7 ? 4 : daysAgo < 30 ? 3 : daysAgo < 90 ? 2 : 1;

  const hitRate = s.linked_signals_count / s.signals_count;
  const hit =
    hitRate > 0.5 ? 5 : hitRate > 0.3 ? 4 : hitRate > 0.15 ? 3 : hitRate > 0.05 ? 2 : 1;

  const imp = s.pipeline_impact;
  const impact =
    imp > 500 ? 5 : imp > 100 ? 4 : imp > 50 ? 3 : imp > 10 ? 2 : 1;

  return Math.round((fresh + hit + impact) / 3);
}

function daysSince(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const diffMs = Date.now() - new Date(isoDate).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function formatDaysAgo(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "dzisiaj";
  if (days === 1) return "wczoraj";
  if (days < 7) return `${days} dni temu`;
  if (days < 30) return `${Math.floor(days / 7)} tyg. temu`;
  return `${Math.floor(days / 30)} mies. temu`;
}

export default function SignalsPage() {
  const [summaries, setSummaries] = useState<SignalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [strengthFilter, setStrengthFilter] = useState<StrengthFilter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Drill-down feed: clicking a summary tile reveals the underlying signals.
  const [feedMode, setFeedMode] = useState<FeedMode>(null);
  const [feedSignals, setFeedSignals] = useState<Signal[] | null>(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedCampaigns, setFeedCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    api.campaigns.list().then(setFeedCampaigns).catch(() => {});
  }, []);

  async function openFeed(mode: Exclude<FeedMode, null>) {
    if (feedMode === mode) {
      setFeedMode(null);
      return;
    }
    setFeedMode(mode);
    if (feedSignals === null) {
      setFeedLoading(true);
      try {
        setFeedSignals(await api.signals.list({ limit: 300 }));
      } catch {
        setFeedSignals([]);
      } finally {
        setFeedLoading(false);
      }
    }
  }

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setSummaries(await api.signals.summary());
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd ładowania");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const availableTypes = useMemo(() => {
    const set = new Set<SourceType>();
    for (const s of summaries) set.add(s.source_type);
    return Array.from(set);
  }, [summaries]);

  const filtered = useMemo(() => {
    const cutoff = daysCutoffMs(timeFilter);
    const fromMs = customFrom ? new Date(customFrom).getTime() : null;
    const toMs = customTo ? new Date(customTo).getTime() + 86_400_000 : null;

    return summaries.filter((s) => {
      if (typeFilter !== "all" && s.source_type !== typeFilter) return false;

      if (strengthFilter !== "all") {
        const str = computeStrength(s);
        if (strengthFilter === "strong" && str < 4) return false;
        if (strengthFilter === "medium" && (str < 2 || str > 3)) return false;
        if (strengthFilter === "weak" && str > 1) return false;
      }

      if (timeFilter !== "all") {
        if (!s.latest_signal_at) return false;
        const ts = new Date(s.latest_signal_at).getTime();
        if (timeFilter === "custom") {
          if (fromMs !== null && ts < fromMs) return false;
          if (toMs !== null && ts > toMs) return false;
        } else if (cutoff !== null) {
          if (Date.now() - ts > cutoff) return false;
        }
      }

      return true;
    });
  }, [summaries, strengthFilter, timeFilter, typeFilter, customFrom, customTo]);

  const totalSignals = filtered.reduce((a, s) => a + s.signals_count, 0);
  const totalCompanies = filtered.reduce((a, s) => a + s.unique_companies, 0);
  const totalImpact = filtered.reduce((a, s) => a + s.pipeline_impact, 0);

  const hasActiveFilter =
    strengthFilter !== "all" || timeFilter !== "all" || typeFilter !== "all";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sygnały</h2>
          <p className="mt-1 text-sm text-gray-600">
            {filtered.length}
            {hasActiveFilter && ` z ${summaries.length}`}{" "}
            {filtered.length === 1 ? "aktywne źródło" : "aktywnych źródeł"}{" "}
            sygnałów zakupowych
          </p>
        </div>
        <button
          onClick={refresh}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100"
        >
          Odśwież
        </button>
      </div>

      {/* Summary tiles — clickable to reveal the underlying signals */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryTile
          icon={Bell}
          accent="bg-amber-100 text-amber-700"
          value={totalSignals}
          label="Detekcji"
          active={feedMode === "all"}
          onClick={() => openFeed("all")}
        />
        <SummaryTile
          icon={Building2}
          accent="bg-blue-100 text-blue-700"
          value={totalCompanies}
          label="Firm z sygnałem"
          active={feedMode === "companies"}
          onClick={() => openFeed("companies")}
        />
        <SummaryTile
          icon={TrendingUp}
          accent="bg-emerald-100 text-emerald-700"
          value={totalImpact}
          label="Wpływ na pipeline"
          prefix="+"
          active={feedMode === "linked"}
          onClick={() => openFeed("linked")}
        />
      </div>

      {feedMode && (
        <SignalsFeed
          mode={feedMode}
          loading={feedLoading}
          signals={feedSignals ?? []}
          campaigns={feedCampaigns}
          onClose={() => setFeedMode(null)}
        />
      )}

      {/* Filters */}
      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-3">
          <FilterGroup
            label="Siła"
            value={strengthFilter}
            onChange={(v) => setStrengthFilter(v as StrengthFilter)}
            options={(
              Object.keys(STRENGTH_LABELS) as StrengthFilter[]
            ).map((v) => ({ value: v, label: STRENGTH_LABELS[v] }))}
          />
          <FilterGroup
            label="Czas"
            value={timeFilter}
            onChange={(v) => setTimeFilter(v as TimeFilter)}
            options={(Object.keys(TIME_LABELS) as TimeFilter[]).map(
              (v) => ({ value: v, label: TIME_LABELS[v] }),
            )}
          />
          <FilterGroup
            label="Źródło"
            value={typeFilter}
            onChange={(v) => setTypeFilter(v as TypeFilter)}
            options={[
              { value: "all" as TypeFilter, label: "Wszystkie" },
              ...availableTypes.map((t) => ({
                value: t as TypeFilter,
                label: TYPE_LABELS[t] ?? t,
              })),
            ]}
          />
          {hasActiveFilter && (
            <button
              onClick={() => {
                setStrengthFilter("all");
                setTimeFilter("all");
                setTypeFilter("all");
                setCustomFrom("");
                setCustomTo("");
              }}
              className="ml-auto text-xs text-gray-500 hover:text-gray-900 underline"
            >
              wyczyść filtry
            </button>
          )}
        </div>
        {timeFilter === "custom" && (
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3">
            <label className="text-xs font-medium uppercase text-gray-500">
              Od
            </label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs"
            />
            <label className="ml-2 text-xs font-medium uppercase text-gray-500">
              Do
            </label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Ładowanie...</p>
      ) : summaries.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
          Brak źródeł. Dodaj pierwsze w zakładce{" "}
          <Link href="/signal-sources" className="underline">
            Źródła
          </Link>
          .
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
          Brak źródeł pasujących do filtrów.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((s) => (
            <SignalCard key={s.source_id} summary={s} />
          ))}
        </div>
      )}
    </div>
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
      <div className="flex flex-wrap rounded-md border border-gray-300 text-xs">
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

function SignalCard({ summary: s }: { summary: SignalSummary }) {
  const strength = computeStrength(s);
  const days = daysSince(s.latest_signal_at);
  const Icon = TYPE_ICONS[s.source_type] ?? Bell;

  const strengthBar =
    strength >= 4
      ? "bg-emerald-500"
      : strength >= 2
        ? "bg-amber-500"
        : "bg-gray-300";

  return (
    <Link
      href={`/signals/${s.source_id}`}
      className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-400 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            TYPE_ACCENTS[s.source_type] ?? "bg-gray-100 text-gray-700"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-gray-900">
            {s.source_name}
          </h3>
          <p className="text-xs text-gray-500">
            {TYPE_LABELS[s.source_type] ?? s.source_type}
          </p>
        </div>
        {!s.enabled && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
            wyłączone
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat
          label="Firm"
          value={s.unique_companies.toString()}
          hint={`${s.signals_count} detekcji`}
        />
        <Stat
          label="Ostatnio"
          value={formatDaysAgo(days)}
          hint={s.latest_signal_at ? "" : "nie odpalone"}
        />
        <Stat
          label="Pipeline"
          value={`+${s.pipeline_impact}`}
          hint={`${s.linked_leads_count} ${s.linked_leads_count === 1 ? "lead" : "leadów"}`}
          highlight
        />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2">
          <span className="text-xs font-medium uppercase text-gray-500">
            Siła
          </span>
          <div className="flex flex-1 items-center gap-1.5">
            <div className="h-1.5 max-w-[120px] flex-1 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full ${strengthBar}`}
                style={{ width: `${(strength / 5) * 100}%` }}
              />
            </div>
            <span className="font-mono text-xs font-semibold text-gray-600">
              {strength}/5
            </span>
          </div>
        </div>

        {s.signals_count > 0 && (
          <p className="shrink-0 text-xs text-gray-500">
            hit rate:{" "}
            {Math.round(
              (s.linked_signals_count / s.signals_count) * 100,
            )}
            %
          </p>
        )}
      </div>
    </Link>
  );
}

function SummaryTile({
  icon: Icon,
  accent,
  value,
  label,
  prefix = "",
  active = false,
  onClick,
}: {
  icon: LucideIcon;
  accent: string;
  value: number;
  label: string;
  prefix?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-gray-300 hover:shadow-md " +
        (active ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-200")
      }
    >
      <div className="flex items-center justify-between">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[11px] font-medium text-gray-400">
          {active ? "ukryj ▲" : "pokaż ▼"}
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900">
        {prefix}
        {value}
      </p>
      <p className="text-xs text-gray-500">{label}</p>
    </button>
  );
}

const FEED_TITLES: Record<Exclude<FeedMode, null>, string> = {
  all: "Wszystkie detekcje",
  companies: "Firmy z sygnałem",
  linked: "Wpływ na pipeline",
};

function signalCompany(s: Signal): string {
  return (
    (s.payload?.company_name as string | undefined) ||
    s.company_domain ||
    "(bez firmy)"
  );
}

function SignalsFeed({
  mode,
  loading,
  signals,
  campaigns,
  onClose,
}: {
  mode: Exclude<FeedMode, null>;
  loading: boolean;
  signals: Signal[];
  campaigns: Campaign[];
  onClose: () => void;
}) {
  // Pipeline tile breakdown: by campaign / company / person.
  const [pipeBy, setPipeBy] = useState<"kampanie" | "firmy" | "osoby">("firmy");

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">
          {FEED_TITLES[mode]}
        </h3>
        <button
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
        >
          Zamknij
        </button>
      </div>

      {loading ? (
        <p className="p-6 text-center text-sm text-gray-500">Ładuję…</p>
      ) : mode === "all" ? (
        <SignalList signals={signals} />
      ) : mode === "companies" ? (
        <CompanyBreakdown signals={signals} />
      ) : (
        <div>
          <div className="flex gap-1 border-b border-gray-100 p-2">
            {(["kampanie", "firmy", "osoby"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setPipeBy(k)}
                className={
                  "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition " +
                  (pipeBy === k
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100")
                }
              >
                {k}
              </button>
            ))}
          </div>
          {pipeBy === "kampanie" ? (
            <CampaignBreakdown campaigns={campaigns} />
          ) : (
            <EntityBreakdown
              signals={signals.filter((s) => s.lead_id != null)}
              by={pipeBy}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SignalList({ signals }: { signals: Signal[] }) {
  if (signals.length === 0)
    return (
      <p className="p-6 text-center text-sm text-gray-500">Brak sygnałów.</p>
    );
  return (
    <div className="max-h-[480px] divide-y divide-gray-100 overflow-y-auto">
      {signals.map((s) => (
        <div key={s.id} className="flex items-start gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <span className="truncate text-sm font-medium text-gray-900">
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-indigo-600 hover:underline"
                >
                  {s.title}
                </a>
              ) : (
                s.title
              )}
            </span>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" /> {signalCompany(s)}
              </span>
              {s.source_name && <span>· {s.source_name}</span>}
              <span>· {new Date(s.detected_at).toLocaleDateString("pl-PL")}</span>
              {s.lead_email && (
                <span className="text-emerald-600">· {s.lead_email}</span>
              )}
            </div>
          </div>
          {s.lead_id != null && (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              +{s.score_weight}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function CompanyBreakdown({ signals }: { signals: Signal[] }) {
  const groups = new Map<string, { count: number; score: number }>();
  for (const s of signals) {
    if (!s.company_domain && !(s.payload?.company_name as string | undefined))
      continue;
    const k = signalCompany(s);
    const g = groups.get(k) ?? { count: 0, score: 0 };
    g.count += 1;
    g.score += s.lead_id != null ? s.score_weight : 0;
    groups.set(k, g);
  }
  const rows = [...groups.entries()].sort((a, b) => b[1].count - a[1].count);
  if (rows.length === 0)
    return <p className="p-6 text-center text-sm text-gray-500">Brak firm.</p>;
  return (
    <div className="max-h-[480px] divide-y divide-gray-100 overflow-y-auto">
      {rows.map(([name, g]) => (
        <div key={name} className="flex items-center justify-between px-4 py-2.5">
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-900">
            <Building2 className="h-3.5 w-3.5 text-gray-400" /> {name}
          </span>
          <span className="flex items-center gap-2 text-xs text-gray-500">
            <span>{g.count} sygn.</span>
            {g.score > 0 && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                +{g.score} pipeline
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function EntityBreakdown({
  signals,
  by,
}: {
  signals: Signal[];
  by: "firmy" | "osoby";
}) {
  const groups = new Map<string, { count: number; score: number }>();
  for (const s of signals) {
    const k =
      by === "firmy" ? signalCompany(s) : s.lead_email || "(nieznana osoba)";
    const g = groups.get(k) ?? { count: 0, score: 0 };
    g.count += 1;
    g.score += s.score_weight;
    groups.set(k, g);
  }
  const rows = [...groups.entries()].sort((a, b) => b[1].score - a[1].score);
  if (rows.length === 0)
    return (
      <p className="p-6 text-center text-sm text-gray-500">
        Brak sygnałów dopiętych do leadów.
      </p>
    );
  return (
    <div className="max-h-[440px] divide-y divide-gray-100 overflow-y-auto">
      {rows.map(([name, g]) => (
        <div key={name} className="flex items-center justify-between px-4 py-2.5">
          <span className="truncate text-sm font-medium text-gray-900">
            {name}
          </span>
          <span className="flex items-center gap-2 text-xs text-gray-500">
            <span>{g.count} sygn.</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
              +{g.score}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function CampaignBreakdown({ campaigns }: { campaigns: Campaign[] }) {
  const rows = [...campaigns]
    .filter((c) => c.enrollments_count > 0)
    .sort((a, b) => b.enrollments_count - a.enrollments_count);
  if (rows.length === 0)
    return (
      <p className="p-6 text-center text-sm text-gray-500">
        Brak kampanii z prospektami.
      </p>
    );
  return (
    <div className="max-h-[440px] divide-y divide-gray-100 overflow-y-auto">
      {rows.map((c) => {
        const value = (c.deal_value || 0) * c.enrollments_count;
        return (
          <div key={c.id} className="flex items-center justify-between px-4 py-2.5">
            <a
              href={`/campaigns/${c.id}`}
              className="truncate text-sm font-medium text-gray-900 hover:text-indigo-600 hover:underline"
            >
              {c.name}
            </a>
            <span className="flex items-center gap-2 text-xs text-gray-500">
              <span>{c.enrollments_count} prospektów</span>
              {value > 0 && (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">
                  {value.toLocaleString("pl-PL")} zł
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  highlight = false,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p
        className={
          "mt-0.5 text-xl font-bold " +
          (highlight ? "text-emerald-700" : "text-gray-900")
        }
      >
        {value}
      </p>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}
