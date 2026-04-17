"use client";

import { FormEvent, useEffect, useState } from "react";

import { api, ApiError, SignalSource, SourceType } from "@/lib/api-client";

type Tab = "rss" | "pracuj_pl";

const TYPE_LABELS: Record<SourceType, string> = {
  rss: "RSS / Atom feed",
  pracuj_pl: "pracuj.pl",
  job_posting: "Job posting (soon)",
  news: "News (soon)",
  tech_change: "Tech change (soon)",
};

export default function SignalSourcesPage() {
  const [sources, setSources] = useState<SignalSource[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<Tab>("pracuj_pl");

  // RSS form
  const [rssName, setRssName] = useState("");
  const [rssFeedUrl, setRssFeedUrl] = useState("");
  const [rssCompanyDomain, setRssCompanyDomain] = useState("");
  const [rssScoreWeight, setRssScoreWeight] = useState(5);

  // pracuj.pl form
  const [pjName, setPjName] = useState("");
  const [pjKeywords, setPjKeywords] = useState("");
  const [pjMaxPerKeyword, setPjMaxPerKeyword] = useState(50);
  const [pjScoreWeight, setPjScoreWeight] = useState(25);

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

  async function handleCreateRss(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await api.signalSources.create({
        name: rssName,
        type: "rss",
        config: {
          feed_url: rssFeedUrl,
          company_domain: rssCompanyDomain || undefined,
          max_entries: 50,
        },
        score_weight: rssScoreWeight,
      });
      setRssName("");
      setRssFeedUrl("");
      setRssCompanyDomain("");
      setRssScoreWeight(5);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd tworzenia");
    } finally {
      setCreating(false);
    }
  }

  async function handleCreatePracuj(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const keywords = pjKeywords
        .split("\n")
        .map((k) => k.trim())
        .filter(Boolean);
      if (keywords.length === 0) {
        setError("Podaj przynajmniej jedno słowo kluczowe");
        setCreating(false);
        return;
      }
      await api.signalSources.create({
        name: pjName,
        type: "pracuj_pl",
        config: {
          keywords,
          max_per_keyword: pjMaxPerKeyword,
        },
        score_weight: pjScoreWeight,
      });
      setPjName("");
      setPjKeywords("");
      setPjMaxPerKeyword(50);
      setPjScoreWeight(25);
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

      {/* Tab switcher */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setTab("pracuj_pl")}
            className={
              "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition " +
              (tab === "pracuj_pl"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-900")
            }
          >
            pracuj.pl
          </button>
          <button
            onClick={() => setTab("rss")}
            className={
              "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition " +
              (tab === "rss"
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-900")
            }
          >
            RSS / Atom
          </button>
        </div>

        {tab === "pracuj_pl" && (
          <form onSubmit={handleCreatePracuj} className="space-y-3 p-4">
            <p className="text-xs text-gray-500">
              Scrapuje{" "}
              <code className="rounded bg-gray-100 px-1">pracuj.pl</code> po
              słowach kluczowych. Każda oferta = 1 sygnał z firmą, lokalizacją,
              opisem stanowiska i AI-summary. Auto-link do leadów po nazwie
              firmy (z normalizacją sufiksów typu „sp. z o.o.").
            </p>
            <input
              type="text"
              required
              maxLength={255}
              placeholder="Nazwa źródła (np. pracuj.pl — HR Manager openings) *"
              value={pjName}
              onChange={(e) => setPjName(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <textarea
              required
              rows={4}
              placeholder={
                "Słowa kluczowe — jedno na linię\nnp.:\nHR Manager\nSpecjalista HR\nHR Business Partner"
              }
              value={pjKeywords}
              onChange={(e) => setPjKeywords(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
            />
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">
                  Max ofert/keyword:
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={pjMaxPerKeyword}
                  onChange={(e) =>
                    setPjMaxPerKeyword(Number(e.target.value))
                  }
                  className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">Score weight:</label>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={pjScoreWeight}
                  onChange={(e) => setPjScoreWeight(Number(e.target.value))}
                  className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm"
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
        )}

        {tab === "rss" && (
          <form onSubmit={handleCreateRss} className="space-y-3 p-4">
            <p className="text-xs text-gray-500">
              Generic RSS/Atom feed scraper. Każdy entry = 1 sygnał. Auto-link
              do leadów po email-domain match (
              <code className="rounded bg-gray-100 px-1">
                jane@acme.io
              </code>{" "}
              ↔ <code className="rounded bg-gray-100 px-1">acme.io</code>).
            </p>
            <input
              type="text"
              required
              maxLength={255}
              placeholder="Nazwa źródła *"
              value={rssName}
              onChange={(e) => setRssName(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              type="url"
              required
              placeholder="URL feedu RSS/Atom *"
              value={rssFeedUrl}
              onChange={(e) => setRssFeedUrl(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                type="text"
                placeholder="company_domain (np. acme.io) — auto-link"
                value={rssCompanyDomain}
                onChange={(e) => setRssCompanyDomain(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">Score weight:</label>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={rssScoreWeight}
                  onChange={(e) => setRssScoreWeight(Number(e.target.value))}
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
        )}
      </div>

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
                        {TYPE_LABELS[s.type] ?? s.type}
                      </span>
                      {!s.enabled && (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
                          wyłączone
                        </span>
                      )}
                    </div>

                    {/* Type-specific config preview */}
                    {s.type === "rss" &&
                      typeof s.config.feed_url === "string" && (
                        <p className="mt-1 truncate font-mono text-xs text-gray-500">
                          {s.config.feed_url as string}
                        </p>
                      )}
                    {s.type === "pracuj_pl" &&
                      Array.isArray(s.config.keywords) && (
                        <p className="mt-1 text-xs text-gray-500">
                          keywords:{" "}
                          {(s.config.keywords as string[])
                            .map((k) => `"${k}"`)
                            .join(", ")}
                        </p>
                      )}

                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                      {s.type === "rss" && (
                        <span>
                          domain:{" "}
                          <code className="rounded bg-gray-100 px-1">
                            {(s.config.company_domain as
                              | string
                              | undefined) || "—"}
                          </code>
                        </span>
                      )}
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
        <strong className="text-gray-700">Jak to działa:</strong> worker ARQ
        odpala wszystkie włączone źródła co 15 min (oraz przy starcie). Dla
        sygnałów z polem <code>company_domain</code> linkowanie idzie po
        email-domain (RSS). Dla sygnałów z <code>company_name</code> w payloadu
        (pracuj.pl) — fuzzy match po znormalizowanej nazwie firmy z leadów. Hit
        bumpuje <code>lead.score</code> o <code>score_weight</code> źródła.
      </div>
    </div>
  );
}
