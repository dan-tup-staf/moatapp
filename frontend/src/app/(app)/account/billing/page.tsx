"use client";

import { Check, CreditCard, ExternalLink, Loader2, Zap } from "lucide-react";
import { useEffect, useState } from "react";

import { AccountOverview, api, ApiError } from "@/lib/api-client";

export default function AccountBillingPage() {
  const [data, setData] = useState<AccountOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    try {
      setData(await api.account.overview());
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Błąd ładowania");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function upgrade(plan: "pro" | "scale") {
    setBusy(plan);
    setNotice(null);
    try {
      const r = await api.account.checkout(plan);
      if (r.url) {
        window.location.href = r.url;
        return;
      }
      setNotice(r.message || "Płatności online nie są jeszcze włączone.");
    } catch (e) {
      setNotice(e instanceof ApiError ? e.detail : "Błąd płatności");
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy("portal");
    setNotice(null);
    try {
      const r = await api.account.billingPortal();
      if (r.url) window.location.href = r.url;
      else setNotice(r.message || "Portal niedostępny.");
    } catch (e) {
      setNotice(e instanceof ApiError ? e.detail : "Błąd");
    } finally {
      setBusy(null);
    }
  }

  if (error)
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    );
  if (!data) return <p className="text-sm text-gray-500">Ładowanie…</p>;

  const current = data.plans.find((p) => p.is_current);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Płatności i plan</h1>
        <p className="mt-1 text-sm text-gray-500">
          Twój plan, zużycie limitów i zmiana subskrypcji.
        </p>
      </div>

      {!data.billing_enabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Płatności online są w trybie podglądu — po podłączeniu Stripe (klucze w
          TODO_USER.md) przyciski „Wybierz plan” uruchomią realną płatność.
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          {notice}
        </div>
      )}

      {/* Current plan + usage */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              Aktualny plan
            </p>
            <p className="mt-1 flex items-center gap-2 text-xl font-bold text-gray-900">
              {current?.name || data.plan}
              <span
                className={
                  "rounded-full px-2 py-0.5 text-[11px] font-medium " +
                  (data.plan_status === "active"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700")
                }
              >
                {data.plan_status}
              </span>
            </p>
          </div>
          {data.billing_enabled && data.plan !== "free" && (
            <button
              onClick={openPortal}
              disabled={busy === "portal"}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              <CreditCard className="h-4 w-4" /> Zarządzaj płatnościami
            </button>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.usage.map((u) => {
            const pct =
              u.limit && u.limit > 0
                ? Math.min(100, Math.round(((u.used || 0) / u.limit) * 100))
                : 0;
            const over = u.limit != null && (u.used || 0) >= u.limit;
            return (
              <div
                key={u.key}
                className="rounded-lg border border-gray-100 bg-gray-50/60 p-3"
              >
                <p className="text-xs text-gray-500">{u.label}</p>
                <p className="mt-0.5 text-lg font-semibold text-gray-900">
                  {u.used ?? 0}
                  <span className="text-sm font-normal text-gray-400">
                    {" "}
                    / {u.limit == null ? "∞" : u.limit}
                  </span>
                </p>
                {u.limit != null && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={
                        "h-full rounded-full " +
                        (over ? "bg-red-500" : "bg-indigo-500")
                      }
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Plans */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900">Plany</h2>
        <div className="mt-3 grid grid-cols-1 gap-5 md:grid-cols-3">
          {data.plans.map((p) => (
            <div
              key={p.key}
              className={
                "relative rounded-2xl border bg-white p-5 " +
                (p.is_current
                  ? "border-indigo-300 ring-1 ring-indigo-200"
                  : "border-gray-200")
              }
            >
              {p.is_current && (
                <span className="absolute -top-3 left-5 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-medium text-white">
                  Twój plan
                </span>
              )}
              <h3 className="font-semibold text-gray-900">{p.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold">
                  {p.price_pln == null
                    ? "Kontakt"
                    : p.price_pln === 0
                      ? "0 zł"
                      : `${p.price_pln} zł`}
                </span>
                {p.period && (
                  <span className="text-sm text-gray-500">{p.period}</span>
                )}
              </div>
              <ul className="mt-4 space-y-2">
                {p.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-gray-700"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                {p.is_current ? (
                  <button
                    disabled
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-400"
                  >
                    Aktywny
                  </button>
                ) : p.key === "free" ? (
                  <button
                    disabled
                    className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-400"
                  >
                    Plan podstawowy
                  </button>
                ) : p.key === "scale" ? (
                  <a
                    href="mailto:daniel.tupczynski@staffly.pl?subject=MOATION%20Scale"
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <ExternalLink className="h-4 w-4" /> Porozmawiajmy
                  </a>
                ) : (
                  <button
                    onClick={() => upgrade(p.key as "pro" | "scale")}
                    disabled={busy === p.key}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {busy === p.key ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    Wybierz {p.name}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
