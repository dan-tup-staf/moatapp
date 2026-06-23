"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { api, ApiError, SignalSummary, SourceType } from "@/lib/api-client";

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
            {filtered.length === 1 ? "źródło" : "źródeł"} · {totalSignals}{" "}
            detekcji · {totalCompanies} firm · +{totalImpact} pipeline
          </p>
        </div>
        <button
          onClick={refresh}
          className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
        >
          Odśwież
        </button>
      </div>

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

  const strengthColor =
    strength >= 4
      ? "text-emerald-600"
      : strength >= 2
        ? "text-yellow-600"
        : "text-gray-400";

  return (
    <Link
      href={`/signals/${s.source_id}`}
      className="block rounded-lg border border-gray-200 bg-white p-5 transition hover:border-gray-400 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 font-semibold text-gray-900">
          {s.source_name}
        </h3>
        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
          {TYPE_LABELS[s.source_type] ?? s.source_type}
        </span>
      </div>

      {!s.enabled && (
        <span className="mt-2 inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
          wyłączone
        </span>
      )}

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

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase text-gray-500">
            Siła
          </span>
          <div className={"text-lg tracking-wide " + strengthColor}>
            {"●".repeat(strength)}
            <span className="text-gray-200">
              {"○".repeat(5 - strength)}
            </span>
          </div>
        </div>

        {s.signals_count > 0 && (
          <p className="text-xs text-gray-500">
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
