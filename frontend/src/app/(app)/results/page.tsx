"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ChevronRight,
  Mail,
  MousePointerClick,
  Reply,
  Send,
  Users,
} from "lucide-react";

import { api, ApiError, CampaignResult, ResultsResponse } from "@/lib/api-client";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-emerald-100 text-emerald-800",
  paused: "bg-amber-100 text-amber-800",
  archived: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Szkic",
  active: "Aktywna",
  paused: "Wstrzymana",
  archived: "Archiwum",
};

export default function ResultsPage() {
  const [data, setData] = useState<ResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.dashboard
      .results()
      .then(setData)
      .catch((e) =>
        setError(e instanceof ApiError ? e.detail : "Błąd ładowania"),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Ładowanie…</p>;
  if (error)
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    );
  if (!data) return null;

  const t = data.totals;
  const rows = [...data.campaigns].sort((a, b) => b.sent - a.sent);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Wyniki</h2>
        <p className="mt-1 text-sm text-gray-600">
          Skuteczność outreachu per sekwencja — wysłane, otwarcia, kliknięcia i
          odpowiedzi.
        </p>
      </div>

      {/* Overall rate tiles */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <RateTile
          icon={Send}
          accent="bg-blue-100 text-blue-700"
          big={t.sent}
          label="Wysłane"
          sub={`${t.enrolled} odbiorców`}
        />
        <RateTile
          icon={Mail}
          accent="bg-emerald-100 text-emerald-700"
          big={`${t.open_rate}%`}
          label="Open rate"
          sub={`${t.opened} otwarć`}
        />
        <RateTile
          icon={MousePointerClick}
          accent="bg-violet-100 text-violet-700"
          big={`${t.click_rate}%`}
          label="Click rate"
          sub={`${t.clicked} kliknięć`}
        />
        <RateTile
          icon={Reply}
          accent="bg-amber-100 text-amber-700"
          big={`${t.reply_rate}%`}
          label="Reply rate"
          sub={`${t.replied} odpowiedzi`}
        />
      </div>

      {/* Per-sequence table */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">
            Brak sekwencji. Utwórz sekwencję i wyślij pierwsze maile, aby zobaczyć
            wyniki.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                  Sekwencja
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-600">
                  Wysłane
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                  Open
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                  Click
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                  Reply
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((c) => (
                <ResultRow key={c.campaign_id} c={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ResultRow({ c }: { c: CampaignResult }) {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <Link
          href={`/campaigns/${c.campaign_id}`}
          className="font-medium text-gray-900 hover:underline"
        >
          {c.name}
        </Link>
        <div className="mt-0.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] ${
              STATUS_STYLES[c.status] ?? "bg-gray-100 text-gray-700"
            }`}
          >
            {STATUS_LABELS[c.status] ?? c.status}
          </span>
          {c.bounced > 0 && (
            <span className="ml-1 text-[11px] text-rose-600">
              {c.bounced} odbić
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">
        {c.sent}
      </td>
      <td className="px-4 py-3">
        <RateBar pct={c.open_rate} count={c.opened} color="bg-emerald-500" />
      </td>
      <td className="px-4 py-3">
        <RateBar pct={c.click_rate} count={c.clicked} color="bg-violet-500" />
      </td>
      <td className="px-4 py-3">
        <RateBar pct={c.reply_rate} count={c.replied} color="bg-amber-500" />
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/campaigns/${c.campaign_id}`}
          className="text-gray-300 hover:text-gray-600"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </td>
    </tr>
  );
}

function RateBar({
  pct,
  count,
  color,
}: {
  pct: number;
  count: number;
  color: string;
}) {
  return (
    <div className="min-w-[110px]">
      <div className="flex items-center gap-2">
        <span className="w-10 font-mono text-xs font-semibold text-gray-700">
          {pct}%
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${color}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      </div>
      <p className="mt-0.5 text-[10px] text-gray-400">{count}</p>
    </div>
  );
}

function RateTile({
  icon: Icon,
  accent,
  big,
  label,
  sub,
}: {
  icon: typeof Send;
  accent: string;
  big: string | number;
  label: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-3xl font-bold text-gray-900">{big}</p>
      <p className="text-xs font-medium text-gray-600">{label}</p>
      <p className="text-[11px] text-gray-400">{sub}</p>
    </div>
  );
}
