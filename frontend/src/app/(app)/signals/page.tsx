"use client";

import { useEffect, useState } from "react";

import { api, ApiError, Signal } from "@/lib/api-client";

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setSignals(await api.signals.list(100));
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd ładowania");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleDelete(id: number) {
    if (!window.confirm("Usunąć ten sygnał?")) return;
    try {
      await api.signals.delete(id);
      await refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Błąd");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sygnały</h2>
          <p className="mt-1 text-sm text-gray-600">
            Buying signals z aktywnych źródeł
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

      <div className="rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Ładowanie...</p>
        ) : signals.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">
            Brak sygnałów. Dodaj źródło na zakładce{" "}
            <a href="/signal-sources" className="underline">
              Źródła
            </a>{" "}
            i odpal je.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {signals.map((s) => (
              <li key={s.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{new Date(s.detected_at).toLocaleString("pl-PL")}</span>
                      <span>•</span>
                      <span>{s.source_name || `source #${s.source_id}`}</span>
                      {s.company_domain && (
                        <>
                          <span>•</span>
                          <code className="rounded bg-gray-100 px-1">
                            {s.company_domain}
                          </code>
                        </>
                      )}
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5">
                        +{s.score_weight}
                      </span>
                    </div>

                    {s.url ? (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="mt-1 block font-medium text-gray-900 hover:underline"
                      >
                        {s.title}
                      </a>
                    ) : (
                      <p className="mt-1 font-medium text-gray-900">{s.title}</p>
                    )}

                    {typeof s.payload.summary === "string" && s.payload.summary && (
                      <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                        {s.payload.summary as string}
                      </p>
                    )}

                    {s.lead_email ? (
                      <p className="mt-2 text-xs text-emerald-700">
                        ✓ powiązane z leadem{" "}
                        <span className="font-medium">{s.lead_email}</span>
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-gray-400">
                        bez powiązania z leadem
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleDelete(s.id)}
                    className="shrink-0 text-xs text-red-600 hover:underline"
                  >
                    Usuń
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
