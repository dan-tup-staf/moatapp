"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { api, ApiError, SignalSummary, SourceType } from "@/lib/api-client";

const TYPE_LABELS: Record<SourceType, string> = {
  rss: "RSS",
  pracuj_pl: "pracuj.pl",
  job_posting: "job posting",
  news: "news",
  tech_change: "tech change",
};

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

  const totalSignals = summaries.reduce((a, s) => a + s.signals_count, 0);
  const totalCompanies = summaries.reduce((a, s) => a + s.unique_companies, 0);
  const totalImpact = summaries.reduce((a, s) => a + s.pipeline_impact, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sygnały</h2>
          <p className="mt-1 text-sm text-gray-600">
            {summaries.length}{" "}
            {summaries.length === 1 ? "źródło" : "źródeł"} · {totalSignals}{" "}
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
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {summaries.map((s) => (
            <SignalCard key={s.source_id} summary={s} />
          ))}
        </div>
      )}
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
