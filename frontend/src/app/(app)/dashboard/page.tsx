"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import {
  Bell,
  Flame,
  type LucideIcon,
  Mail,
  Megaphone,
  Users,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import {
  api,
  ApiError,
  DashboardStats,
  HotLead,
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
          icon={Users}
          accent="bg-blue-100 text-blue-700"
          label="Leady"
          value={stats.leads_total}
          subtitle={`${stats.leads_contacted} skontaktowanych`}
          href="/lists"
        />
        <StatTile
          icon={Megaphone}
          accent="bg-violet-100 text-violet-700"
          label="Kampanie"
          value={stats.campaigns_total}
          subtitle={`${stats.campaigns_active} aktywnych`}
          href="/campaigns"
        />
        <StatTile
          icon={Mail}
          accent="bg-emerald-100 text-emerald-700"
          label="Wysłane (7d)"
          value={stats.messages_sent_last_7d}
          subtitle={`${stats.messages_sent_total} łącznie`}
        />
        <StatTile
          icon={Bell}
          accent="bg-amber-100 text-amber-700"
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
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-100 p-4">
          <Flame className="h-4 w-4 text-rose-500" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Hot leady — top 5 wg score
            </h3>
            <p className="text-xs text-gray-500">
              Leady z najwyższym sumarycznym score z sygnałów
            </p>
          </div>
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
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                  Lead
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                  Firma
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                  Tier / Score
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                  Lista
                </th>
                <th className="px-4 py-2.5 text-center font-medium text-gray-600">
                  Sygnały
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {hotLeads.map((l, i) => {
                const name =
                  [l.first_name, l.last_name].filter(Boolean).join(" ") ||
                  l.email;
                const ini =
                  (
                    (l.first_name?.[0] ?? "") + (l.last_name?.[0] ?? "")
                  ).toUpperCase() ||
                  l.email[0]?.toUpperCase() ||
                  "?";
                const t = tierMeta(l.score);
                return (
                  <tr key={l.id} className="hover:bg-gray-50">
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
                            {l.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {l.company || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${t.soft}`}
                        >
                          {t.key === "t1" && <Flame className="h-3 w-3" />}
                          {t.label}
                        </span>
                        <span className="font-mono text-xs font-semibold text-gray-700">
                          {l.score}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      <Link
                        href={`/lists/${l.list_id}`}
                        className="hover:underline"
                      >
                        {l.list_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="inline-flex items-center gap-1 text-gray-700">
                        <Bell className="h-3.5 w-3.5 text-gray-400" />
                        {l.signals_count}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------- Tier helpers (spójne z ekranem Firmy) ----------

const AVATARS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-sky-500",
];

function tierMeta(score: number): { key: string; label: string; soft: string } {
  if (score > 100)
    return {
      key: "t1",
      label: "Tier 1",
      soft: "bg-rose-50 text-rose-700 border-rose-200",
    };
  if (score > 20)
    return {
      key: "t2",
      label: "Tier 2",
      soft: "bg-amber-50 text-amber-700 border-amber-200",
    };
  if (score > 0)
    return {
      key: "t3",
      label: "Tier 3",
      soft: "bg-sky-50 text-sky-700 border-sky-200",
    };
  return {
    key: "nq",
    label: "Niekwalif.",
    soft: "bg-gray-100 text-gray-600 border-gray-200",
  };
}

// ---------- Pipeline widget (compact) ----------

function tierCounts(bucket: PipelineStageBucket): [number, number, number] {
  const c = [0, 0, 0];
  for (const comp of bucket.companies) c[comp.tier - 1]++;
  return [c[0], c[1], c[2]];
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
          Firmy bucketowane po najwyższym statusie leadów. Tier 1/2/3 wg sumy
          score. „Wybór dostawcy" zapełni się po dodaniu manual override +
          aktywności na stronie.
        </p>
      </div>
      {total === 0 ? (
        <p className="p-4 text-sm text-gray-500">
          Brak firm w pipeline. Dodaj leadów z polem „firma" i rozpocznij
          kampanie.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
          {view.stages.map((stage) => (
            <PipelineStageCard key={stage.stage} bucket={stage} />
          ))}
        </div>
      )}
    </section>
  );
}

function PipelineStageCard({ bucket }: { bucket: PipelineStageBucket }) {
  const [t1, t2, t3] = tierCounts(bucket);
  const empty = bucket.companies_count === 0;

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50/50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {bucket.name}
      </p>
      <p
        className={
          "mt-1 text-3xl font-bold " +
          (empty ? "text-gray-300" : "text-gray-900")
        }
      >
        {bucket.companies_count}
      </p>
      <p className="mt-0.5 text-xs text-gray-500">
        {empty ? (
          "—"
        ) : (
          <>
            Σ score{" "}
            <span className="font-mono text-gray-700">
              {bucket.total_score}
            </span>
          </>
        )}
      </p>

      {!empty && (
        <div className="mt-3 space-y-1 text-xs">
          <TierRow label="Tier 1" count={t1} color="bg-rose-500" />
          <TierRow label="Tier 2" count={t2} color="bg-amber-500" />
          <TierRow label="Tier 3" count={t3} color="bg-sky-500" />
        </div>
      )}
    </div>
  );
}

function TierRow({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  const muted = count === 0;
  return (
    <div className="flex items-center gap-2">
      <span
        className={
          "inline-block h-2 w-2 shrink-0 rounded-full " +
          (muted ? "bg-gray-200" : color)
        }
      />
      <span className={muted ? "text-gray-400" : "text-gray-700"}>
        {label}
      </span>
      <span
        className={
          "ml-auto font-mono " + (muted ? "text-gray-300" : "text-gray-900")
        }
      >
        {count}
      </span>
    </div>
  );
}

function StatTile({
  icon: Icon,
  accent,
  label,
  value,
  subtitle,
  href,
}: {
  icon: LucideIcon;
  accent: string;
  label: string;
  value: number;
  subtitle?: string;
  href?: string;
}) {
  const inner: ReactNode = (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-400 hover:shadow-md">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-xs font-medium text-gray-600">{label}</p>
      {subtitle && <p className="text-[11px] text-gray-400">{subtitle}</p>}
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
