"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import {
  api,
  ApiError,
  DashboardStats,
  HotLead,
  PipelineCompany,
  PipelineStageBucket,
  PipelineView,
} from "@/lib/api-client";

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [hotLeads, setHotLeads] = useState<HotLead[]>([]);
  const [pipeline, setPipeline] = useState<PipelineView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [s, h, p] = await Promise.all([
          api.dashboard.stats(),
          api.dashboard.hotLeads(5),
          api.dashboard.pipeline(),
        ]);
        if (!active) return;
        setStats(s);
        setHotLeads(h);
        setPipeline(p);
      } catch (err) {
        if (active) {
          setError(err instanceof ApiError ? err.detail : "Błąd ładowania");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-gray-500">Ładowanie...</p>;
  }
  if (error) {
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    );
  }
  if (!stats || !user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="mt-1 text-sm text-gray-600">
          Witaj, {user.name || user.email}
        </p>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile
          label="Leady"
          value={stats.leads_total}
          subtitle={`${stats.leads_contacted} skontaktowanych`}
          href="/lists"
        />
        <StatTile
          label="Kampanie"
          value={stats.campaigns_total}
          subtitle={`${stats.campaigns_active} aktywnych`}
          href="/campaigns"
        />
        <StatTile
          label="Wysłane (7d)"
          value={stats.messages_sent_last_7d}
          subtitle={`${stats.messages_sent_total} łącznie`}
        />
        <StatTile
          label="Sygnały (7d)"
          value={stats.signals_last_7d}
          subtitle={`${stats.signals_total} łącznie`}
          href="/signals"
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-xs font-medium uppercase text-gray-500">
          Aktywne enrollmenty
        </p>
        <p className="mt-1 text-2xl font-bold text-gray-900">
          {stats.active_enrollments}
        </p>
        <p className="text-xs text-gray-500">
          Leady czekające na kolejny step kampanii
        </p>
      </div>

      {/* Pipeline */}
      {pipeline && <PipelineWidget view={pipeline} />}

      {/* Hot leads */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700">
            🔥 Hot leady (top 5 by score)
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Leady z najwyższym sumarycznym score z sygnałów
          </p>
        </div>
        {hotLeads.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">
            Brak leadów ze score &gt; 0. Dodaj{" "}
            <Link href="/signal-sources" className="underline">
              źródło sygnałów
            </Link>{" "}
            i odpal je, żeby zobaczyć top.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Lead
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Firma
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Lista
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Status
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">
                  Sygnały
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">
                  Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {hotLeads.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="text-gray-900">{l.email}</div>
                    {(l.first_name || l.last_name) && (
                      <div className="text-xs text-gray-500">
                        {[l.first_name, l.last_name]
                          .filter(Boolean)
                          .join(" ")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {l.company || "—"}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    <Link
                      href={`/lists/${l.list_id}`}
                      className="hover:underline"
                    >
                      {l.list_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700">
                    {l.signals_count}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-gray-900">
                    {l.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------- Pipeline widget ----------

const TIER_COLORS: Record<1 | 2 | 3, string> = {
  1: "bg-emerald-100 text-emerald-800 border-emerald-200",
  2: "bg-amber-100 text-amber-800 border-amber-200",
  3: "bg-gray-100 text-gray-600 border-gray-200",
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function PipelineWidget({ view }: { view: PipelineView }) {
  const total = view.stages.reduce((a, s) => a + s.companies_count, 0);

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-700">
          📈 Pipeline — {total} {total === 1 ? "firma" : "firm"}
        </h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Firmy zagregowane po najwyższym statusie leadów. Tier T1/T2/T3 na
          podstawie sumy score. Przesuwanie etapów „Wybór dostawcy" będzie
          możliwe gdy dodamy manual override + aktywność na stronie.
        </p>
      </div>
      {total === 0 ? (
        <p className="p-4 text-sm text-gray-500">
          Brak firm w pipeline. Dodaj leadów z polem „firma" i rozpocznij
          kampanie.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-4">
          {view.stages.map((stage) => (
            <PipelineColumn key={stage.stage} bucket={stage} />
          ))}
        </div>
      )}
    </section>
  );
}

function PipelineColumn({ bucket }: { bucket: PipelineStageBucket }) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50/50">
      <div className="border-b border-gray-200 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold text-gray-900">
            {bucket.name}
          </h4>
          <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-700">
            {bucket.companies_count}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">
          Σ score {bucket.total_score}
        </p>
      </div>
      <div className="space-y-2 p-3">
        {bucket.companies.length === 0 ? (
          <p className="text-xs text-gray-400">—</p>
        ) : (
          bucket.companies.map((c) => (
            <PipelineCard key={c.company} company={c} />
          ))
        )}
      </div>
    </div>
  );
}

function PipelineCard({ company: c }: { company: PipelineCompany }) {
  const days = daysSince(c.last_activity_at);
  const tierCls = TIER_COLORS[c.tier];

  return (
    <div className="rounded-md border border-gray-200 bg-white p-2.5 text-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate font-medium text-gray-900">
          {c.company}
        </p>
        <span
          className={`shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[10px] ${tierCls}`}
        >
          T{c.tier}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-gray-500">
        <span>
          👤 {c.leads_count}
        </span>
        {c.signals_count > 0 && <span>📡 {c.signals_count}</span>}
        <span className="font-mono text-gray-700">
          {c.total_score > 0 ? `+${c.total_score}` : "0"}
        </span>
        {days !== null && (
          <span className="text-gray-400">
            {days === 0 ? "dziś" : `${days}d`}
          </span>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  subtitle,
  href,
}: {
  label: string;
  value: number;
  subtitle?: string;
  href?: string;
}) {
  const inner: ReactNode = (
    <div className="rounded-lg border border-gray-200 bg-white p-4 transition hover:border-gray-400 hover:shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}
