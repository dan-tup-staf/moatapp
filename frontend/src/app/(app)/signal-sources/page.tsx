"use client";

import { FormEvent, useEffect, useState } from "react";

import { api, ApiError, SignalSource, SourceType } from "@/lib/api-client";

const SOURCE_TYPES: { value: SourceType; label: string; available: boolean }[] = [
  { value: "rss", label: "RSS / Atom feed", available: true },
  { value: "job_posting", label: "Job posting (soon)", available: false },
  { value: "news", label: "News (soon)", available: false },
  { value: "tech_change", label: "Tech change (soon)", available: false },
];

export default function SignalSourcesPage() {
  const [sources, setSources] = useState<SignalSource[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [companyDomain, setCompanyDomain] = useState("");
  const [scoreWeight, setScoreWeight] = useState(5);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [running, setRunning] = useState<number | null>(null);
  const [runMsg, setRunMsg] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setSources(await api.signalSources.list());
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd ładowania");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await api.signalSources.create({
        name,
        type: "rss",
        config: {
          feed_url: feedUrl,
          company_domain: companyDomain || undefined,
          max_entries: 50,
        },
        score_weight: scoreWeight,
      });
      setName("");
      setFeedUrl("");
      setCompanyDomain("");
      setScoreWeight(5);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd tworzenia");
    } finally {
      setCreating(false);
    }
  }

  async function handleRunNow(id: number) {
    setRunning(id);
    setRunMsg(null);
    try {
      const result = await api.signalSources.runNow(id);
      setRunMsg(
        result.error
          ? `Błąd: ${result.error}`
          : `Pobrano ${result.new_signals} nowych sygnałów`,
      );
      await refresh();
    } catch (err) {
      setRunMsg(err instanceof ApiError ? `Błąd: ${err.detail}` : "Błąd");
    } finally {
      setRunning(null);
    }
  }

  async function handleToggle(s: SignalSource) {
    try {
      await api.signalSources.update(s.id, { enabled: !s.enabled });
      await refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Błąd");
    }
  }

  async function handleDelete(s: SignalSource) {
    if (
      !window.confirm(
        `Usunąć źródło "${s.name}" wraz ze wszystkimi sygnałami z niego?`,
      )
    ) {
      return;
    }
    try {
      await api.signalSources.delete(s.id);
      await refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Błąd");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Źródła sygnałów</h2>
        <p className="mt-1 text-sm text-gray-600">
          Konfigurowalne scrapery intent data — worker odpala je co 15 min
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
      >
        <h3 className="text-sm font-medium text-gray-700">Nowe źródło RSS</h3>
        <input
          type="text"
          required
          maxLength={255}
          placeholder="Nazwa źródła *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
        <input
          type="url"
          required
          placeholder="URL feedu RSS/Atom *"
          value={feedUrl}
          onChange={(e) => setFeedUrl(e.target.value)}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            type="text"
            placeholder="company_domain (np. acme.io) — auto-link do leadów"
            value={companyDomain}
            onChange={(e) => setCompanyDomain(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Score weight:</label>
            <input
              type="number"
              min={0}
              max={1000}
              value={scoreWeight}
              onChange={(e) => setScoreWeight(Number(e.target.value))}
              className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {creating ? "Tworzenie..." : "Dodaj źródło"}
        </button>
      </form>

      {runMsg && (
        <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
          {runMsg}
        </p>
      )}

      <div className="rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Ładowanie...</p>
        ) : sources.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">
            Brak źródeł. Dodaj pierwsze powyżej.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {sources.map((s) => (
              <li key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {s.name}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                        {s.type}
                      </span>
                      {!s.enabled && (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                          wyłączone
                        </span>
                      )}
                    </div>
                    {typeof s.config.feed_url === "string" && (
                      <p className="mt-1 truncate font-mono text-xs text-gray-500">
                        {s.config.feed_url as string}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                      <span>
                        domain:{" "}
                        <code className="rounded bg-gray-100 px-1">
                          {(s.config.company_domain as string | undefined) ||
                            "—"}
                        </code>
                      </span>
                      <span>weight: {s.score_weight}</span>
                      <span>{s.signals_count} sygnałów</span>
                      <span>
                        {s.last_run_at
                          ? `ostatnio: ${new Date(s.last_run_at).toLocaleString("pl-PL")}`
                          : "nigdy nie odpalone"}
                      </span>
                    </div>
                    {s.last_error && (
                      <p className="mt-1 text-xs text-red-600">
                        ostatni błąd: {s.last_error}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 text-right">
                    <button
                      onClick={() => handleRunNow(s.id)}
                      disabled={running === s.id}
                      className="rounded-md border border-gray-300 px-3 py-1 text-xs hover:bg-gray-100 disabled:opacity-50"
                    >
                      {running === s.id ? "Pobieram..." : "Uruchom teraz"}
                    </button>
                    <button
                      onClick={() => handleToggle(s)}
                      className="text-xs text-gray-600 hover:underline"
                    >
                      {s.enabled ? "Wyłącz" : "Włącz"}
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Usuń
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-xs text-gray-600">
        <strong className="text-gray-700">Jak to działa:</strong> worker
        ARQ odpala wszystkie włączone źródła co 15 min (oraz przy starcie).
        Każdy sygnał z polem <code>company_domain</code> jest auto-linkowany
        do pierwszego leada w Twoich listach, którego email pasuje (
        <code>jane@acme.io</code> ↔ <code>company_domain=acme.io</code>).
        Linkowanie podbija <code>lead.score</code> o <code>score_weight</code>{" "}
        źródła.
      </div>
    </div>
  );
}
