"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Flame, Info, Pause, Play, ThermometerSun } from "lucide-react";

import { api, ApiError, EmailAccount, WarmupStatus } from "@/lib/api-client";

const STATUS: Record<
  WarmupStatus,
  { label: string; cls: string; dot: string }
> = {
  off: { label: "Wyłączone", cls: "bg-gray-100 text-gray-600", dot: "bg-gray-300" },
  warming: {
    label: "Rozgrzewanie",
    cls: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
  },
  ready: {
    label: "Gotowa",
    cls: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-500",
  },
  paused: {
    label: "Wstrzymane",
    cls: "bg-gray-100 text-gray-500",
    dot: "bg-gray-400",
  },
};

export default function WarmupPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      setAccounts(await api.emailAccounts.list());
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function setWarmup(acc: EmailAccount, status: WarmupStatus) {
    try {
      await api.emailAccounts.update(acc.id, { warmup_status: status });
      refresh();
    } catch (e) {
      alert(e instanceof ApiError ? e.detail : "Błąd");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Rozgrzewanie</h2>
        <p className="mt-1 max-w-2xl text-sm text-gray-600">
          Buduj reputację skrzynki, stopniowo zwiększając dzienny wolumen wysyłki
          (ramp). Świeża skrzynka startuje nisko i rośnie co dzień aż do swojego
          limitu — to chroni przed spamem i banami.
        </p>
      </div>

      <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <div>
          <p className="font-medium">Jak działa ramp</p>
          <p className="mt-1 text-xs text-blue-800">
            Po włączeniu rozgrzewania skrzynka wysyła ~5 maili/dzień i zwiększa o
            ~5 każdego dnia, aż dojdzie do swojego dziennego limitu — wtedy
            automatycznie przechodzi w stan „Gotowa". To prawdziwy mechanizm
            ograniczania wolumenu (egzekwowany przy wysyłce). Symulacja
            zaangażowania (skrzynki piszące do siebie) wymaga zewnętrznej sieci
            (Mailreach/Instantly) — to osobny, płatny krok.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Ładowanie…</p>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <ThermometerSun className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">
            Brak skrzynek.{" "}
            <Link href="/deliverability" className="underline">
              Podłącz skrzynkę
            </Link>{" "}
            w Dostarczalności, aby ją rozgrzewać.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((a) => {
            const s = STATUS[a.warmup_status];
            const pct =
              a.daily_limit > 0
                ? Math.round((a.effective_daily_limit / a.daily_limit) * 100)
                : 0;
            return (
              <div
                key={a.id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                      <Flame className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">
                          {a.email}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {a.warmup_status === "warming"
                          ? `Dzień ${a.warmup_day + 1} · dziś limit ${a.effective_daily_limit}/${a.daily_limit}`
                          : `Limit dzienny ${a.daily_limit}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {a.warmup_status === "warming" ? (
                      <button
                        onClick={() => setWarmup(a, "paused")}
                        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-100"
                      >
                        <Pause className="h-3.5 w-3.5" />
                        Wstrzymaj
                      </button>
                    ) : (
                      <button
                        onClick={() => setWarmup(a, "warming")}
                        className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                      >
                        <Play className="h-3.5 w-3.5" />
                        {a.warmup_status === "ready"
                          ? "Rozgrzej ponownie"
                          : "Rozpocznij rozgrzewanie"}
                      </button>
                    )}
                  </div>
                </div>

                {a.warmup_status === "warming" && (
                  <div className="mt-3">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-gray-400">
                      {pct}% docelowego wolumenu — pełna moc po osiągnięciu limitu
                      {a.daily_limit}/dzień.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
