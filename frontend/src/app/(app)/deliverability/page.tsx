"use client";

import { useEffect, useState } from "react";

import { api, EmailStatus } from "@/lib/api-client";

export default function DeliverabilityPage() {
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setStatus(await api.email.status());
      } catch {
        setStatus(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const configured = status?.configured ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dostarczalność</h2>
        <p className="mt-1 text-sm text-gray-600">
          Zdrowie skrzynek i statystyki dostarczania
        </p>
      </div>

      {/* Mailbox health (real) */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Skrzynka wysyłkowa
          </h3>
          {!loading && (
            <span
              className={
                "rounded-full px-2 py-0.5 text-xs " +
                (configured
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800")
              }
            >
              {configured ? "Podłączona" : "Nie skonfigurowana"}
            </span>
          )}
        </div>
        {!loading && status && (
          <p className="mt-2 text-xs text-gray-500">
            Host:{" "}
            <span className="font-mono">
              {status.host}:{status.port}
            </span>{" "}
            · Szyfrowanie:{" "}
            {status.use_tls ? "TLS" : status.starttls ? "STARTTLS" : "brak"} ·
            Dzienny limit: {status.daily_limit || "∞"}
          </p>
        )}
        <p className="mt-2 text-xs text-gray-500">
          Konfiguracja i test skrzynki: zakładka <strong>Integracje</strong>.
          SPF/DKIM/DMARC będą tu raportowane po dodaniu sekcji <strong>Domeny</strong>.
        </p>
      </div>

      {/* Deliverability stats (placeholder until sends happen) */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
          Statystyki (po pierwszych wysyłkach)
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Dostarczono", hint: "% maili przyjętych" },
            { label: "Bounce rate", hint: "twarde/miękkie odbicia" },
            { label: "Spam rate", hint: "trafienia do spamu" },
            { label: "Open / Reply", hint: "otwarcia i odpowiedzi" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <p className="text-xs font-medium uppercase text-gray-500">
                {s.label}
              </p>
              <p className="mt-1 text-2xl font-bold text-gray-300">—</p>
              <p className="mt-0.5 text-xs text-gray-400">{s.hint}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <span className="font-medium">W budowie:</span>
        <span>
          placement test (inbox vs spam), per-skrzynkowe wykresy, bounce
          handling i alerty zdrowia.
        </span>
      </div>
    </div>
  );
}
