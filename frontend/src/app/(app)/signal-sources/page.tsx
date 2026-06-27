"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Banknote,
  Bell,
  Briefcase,
  Globe,
  type LucideIcon,
  MessageCircle,
  Newspaper,
  Play,
  Power,
  Rss,
  Search,
  Trash2,
  Users,
} from "lucide-react";

import {
  api,
  ApiError,
  SignalSource,
  SignalSourcePreset,
  SourceType,
} from "@/lib/api-client";

type Tab = "presety" | "web" | "pracuj_pl" | "rss";

const TYPE_LABELS: Record<SourceType, string> = {
  rss: "RSS / Atom",
  pracuj_pl: "pracuj.pl",
  linkedin: "LinkedIn",
  google_news: "Google News",
  x_twitter: "X / Twitter",
  serp: "SERP",
  funding: "Bazy fundingowe",
  company_site: "Strona firmowa",
};

const TYPE_ICONS: Record<SourceType, LucideIcon> = {
  rss: Rss,
  pracuj_pl: Briefcase,
  linkedin: Users,
  google_news: Newspaper,
  x_twitter: MessageCircle,
  serp: Search,
  funding: Banknote,
  company_site: Globe,
};

const TYPE_ACCENTS: Record<SourceType, string> = {
  rss: "bg-orange-100 text-orange-700",
  pracuj_pl: "bg-indigo-100 text-indigo-700",
  linkedin: "bg-blue-100 text-blue-700",
  google_news: "bg-rose-100 text-rose-700",
  x_twitter: "bg-sky-100 text-sky-700",
  serp: "bg-emerald-100 text-emerald-700",
  funding: "bg-violet-100 text-violet-700",
  company_site: "bg-gray-100 text-gray-700",
};

// web_search-backed channels (Claude server-side web_search)
const WEB_CHANNELS: {
  value: SourceType;
  label: string;
  hint: string;
  placeholder: string;
}[] = [
  {
    value: "linkedin",
    label: "LinkedIn",
    hint: "Zmiany stanowisk, role C-suite, rekrutacja GTM",
    placeholder: '"Head of AI" OR "Country Manager" nowa rola Polska',
  },
  {
    value: "google_news",
    label: "Google News",
    hint: "Prasa, komunikaty, ESPI/EBI, regulacje",
    placeholder: "runda finansowania OR przejęcie [branża] Polska",
  },
  {
    value: "serp",
    label: "SERP (ogólne)",
    hint: "Rejestry (KRS/RDF/MSiG/Zastawy), BIP, granty, patenty",
    placeholder: "Portal Rejestrów Sądowych zmiana zarządu [branża]",
  },
  {
    value: "funding",
    label: "Bazy fundingowe",
    hint: "Rundy VC/PE, granty NCBR/PARP, M&A",
    placeholder: "runda Series A B [branża] mln zł 2026",
  },
  {
    value: "x_twitter",
    label: "X / Twitter",
    hint: "Zapowiedzi i dyskusje branżowe",
    placeholder: "[firma/branża] zapowiedź OR launch",
  },
  {
    value: "company_site",
    label: "Strona firmowa",
    hint: "Monitoring nowości/komunikatów na stronie firmy (podaj domenę)",
    placeholder: "nowości OR komunikat prasowy OR kariera",
  },
];

export default function SignalSourcesPage() {
  const [sources, setSources] = useState<SignalSource[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<Tab>("presety");

  // Web channel form
  const [webName, setWebName] = useState("");
  const [webChannel, setWebChannel] = useState<SourceType>("linkedin");
  const [webQuery, setWebQuery] = useState("");
  const [webDomain, setWebDomain] = useState("");
  const [webMax, setWebMax] = useState(15);
  const [webScore, setWebScore] = useState(20);

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
  const [runningAll, setRunningAll] = useState(false);

  async function runAll() {
    setRunningAll(true);
    setRunMsg(null);
    setError(null);
    try {
      const res = await api.signalSources.runAll();
      if (res.ran === 0) {
        setRunMsg("Brak włączonych źródeł do uruchomienia.");
      } else {
        const errs = res.results.filter((r) => r.error);
        let msg = `Uruchomiono ${res.ran} źródeł — ${res.total_new_signals} nowych sygnałów.`;
        if (errs.length) {
          msg += ` Błędy (${errs.length}): ${errs
            .map((e) => `${e.name}: ${e.error}`)
            .slice(0, 2)
            .join(" · ")}`;
        }
        setRunMsg(msg);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd uruchamiania");
    } finally {
      setRunningAll(false);
    }
  }

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

  const activeChannel = WEB_CHANNELS.find((c) => c.value === webChannel)!;

  async function handleCreateWeb(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!webQuery.trim()) {
      setError("Podaj zapytanie wyszukiwania");
      return;
    }
    setCreating(true);
    try {
      const config: Record<string, unknown> = {
        query: webQuery.trim(),
        max_results: webMax,
      };
      if (webDomain.trim()) config.company_domain = webDomain.trim();
      await api.signalSources.create({
        name: webName,
        type: webChannel,
        config,
        score_weight: webScore,
      });
      setWebName("");
      setWebQuery("");
      setWebDomain("");
      setWebMax(15);
      setWebScore(20);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd tworzenia");
    } finally {
      setCreating(false);
    }
  }

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

  const TABS: { id: Tab; label: string }[] = [
    { id: "presety", label: "Presety (PL enterprise)" },
    { id: "web", label: "Web (LinkedIn / News / SERP…)" },
    { id: "pracuj_pl", label: "pracuj.pl" },
    { id: "rss", label: "RSS / Atom" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Źródła sygnałów</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Konfigurowalne scrapery intent data. Kanały web (LinkedIn, Google
            News, X, SERP, funding) działają przez AI/web-search. Kliknij
            „Uruchom wszystkie", aby od razu zaciągnąć sygnały.
          </p>
        </div>
        <button
          onClick={runAll}
          disabled={runningAll || sources.length === 0}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          <Play className="h-4 w-4" />
          {runningAll ? "Zaciągam…" : "Uruchom wszystkie"}
        </button>
      </div>

      {/* Tab switcher */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex flex-wrap border-b border-gray-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setError(null);
              }}
              className={
                "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition " +
                (tab === t.id
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-900")
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "presety" && (
          <PresetLibrary
            onActivated={async (n) => {
              setRunMsg(`Aktywowano ${n} źródeł z presetów`);
              await refresh();
            }}
          />
        )}

        {tab === "web" && (
          <form onSubmit={handleCreateWeb} className="space-y-3 p-4">
            <p className="text-xs text-gray-500">
              Generyczny kanał oparty o Claude web_search. Wpisz zapytanie jak
              do Google — filtry <code>site:</code> dokłada silnik. Auto-link do
              leadów po nazwie/domenie firmy z wyników.
            </p>
            <div className="flex flex-wrap gap-2">
              {WEB_CHANNELS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setWebChannel(c.value)}
                  className={
                    "rounded-full px-3 py-1 text-xs font-medium transition " +
                    (webChannel === c.value
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200")
                  }
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">{activeChannel.hint}</p>
            <input
              type="text"
              required
              maxLength={255}
              placeholder="Nazwa źródła *"
              value={webName}
              onChange={(e) => setWebName(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <textarea
              required
              rows={2}
              placeholder={`Zapytanie wyszukiwania, np.: ${activeChannel.placeholder}`}
              value={webQuery}
              onChange={(e) => setWebQuery(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <input
                type="text"
                placeholder={
                  webChannel === "company_site"
                    ? "domena firmy (wymagana) *"
                    : "company_domain (opcjonalnie) — auto-link"
                }
                value={webDomain}
                onChange={(e) => setWebDomain(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">Max wyników:</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={webMax}
                  onChange={(e) => setWebMax(Number(e.target.value))}
                  className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700">Score weight:</label>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={webScore}
                  onChange={(e) => setWebScore(Number(e.target.value))}
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
                  onChange={(e) => setPjMaxPerKeyword(Number(e.target.value))}
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
              <code className="rounded bg-gray-100 px-1">jane@acme.io</code> ↔{" "}
              <code className="rounded bg-gray-100 px-1">acme.io</code>).
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
            Brak źródeł. Dodaj pierwsze powyżej lub aktywuj presety.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sources.map((s) => {
              const Icon = TYPE_ICONS[s.type] ?? Bell;
              return (
                <li key={s.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          TYPE_ACCENTS[s.type] ?? "bg-gray-100 text-gray-700"
                        } ${s.enabled ? "" : "opacity-50"}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {s.name}
                          </span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                            {TYPE_LABELS[s.type] ?? s.type}
                          </span>
                          {!s.enabled && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
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
                        {typeof s.config.query === "string" && (
                          <p className="mt-1 truncate font-mono text-xs text-gray-500">
                            query: {s.config.query as string}
                          </p>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                            waga {s.score_weight}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                            <Bell className="h-3 w-3" />
                            {s.signals_count} sygnałów
                          </span>
                          <span className="text-gray-400">
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
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => handleRunNow(s.id)}
                        disabled={running === s.id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium hover:bg-gray-100 disabled:opacity-50"
                      >
                        <Play className="h-3.5 w-3.5" />
                        {running === s.id ? "Pobieram…" : "Uruchom"}
                      </button>
                      <button
                        onClick={() => handleToggle(s)}
                        title={s.enabled ? "Wyłącz" : "Włącz"}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        <Power className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        title="Usuń źródło"
                        className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-xs text-gray-600">
        <strong className="text-gray-700">Jak to działa:</strong> worker ARQ
        odpala wszystkie włączone źródła co 15 min (oraz przy starcie). Kanały
        web (LinkedIn/News/SERP/funding) wyszukują przez Claude web_search —
        wymagają <code>ANTHROPIC_API_KEY</code>. Linkowanie do leadów: po
        email-domain (RSS) lub po znormalizowanej nazwie firmy (pracuj.pl, web).
        Hit bumpuje <code>lead.score</code> o <code>score_weight</code> źródła.
      </div>
    </div>
  );
}

// ---------- Preset library (curated PL-enterprise templates) ----------

function PresetLibrary({
  onActivated,
}: {
  onActivated: (count: number) => void;
}) {
  const [presets, setPresets] = useState<SignalSourcePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activating, setActivating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setPresets(await api.signalSources.presets());
      } catch (e) {
        setErr(e instanceof ApiError ? e.detail : "Błąd ładowania presetów");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function activate() {
    const chosen = presets.filter((p) => selected.has(p.key));
    if (chosen.length === 0) return;
    setActivating(true);
    setErr(null);
    try {
      await api.signalSources.createBatch(
        chosen.map((p) => ({
          name: p.name,
          type: p.type,
          config: p.config,
          score_weight: p.score_weight,
        })),
      );
      setSelected(new Set());
      onActivated(chosen.length);
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : "Błąd aktywacji");
    } finally {
      setActivating(false);
    }
  }

  if (loading) return <p className="p-4 text-sm text-gray-500">Ładowanie...</p>;

  // group by category_label
  const groups = new Map<string, SignalSourcePreset[]>();
  for (const p of presets) {
    const arr = groups.get(p.category_label) ?? [];
    arr.push(p);
    groups.set(p.category_label, arr);
  }

  return (
    <div className="space-y-4 p-4">
      <p className="text-xs text-gray-500">
        Gotowe źródła sygnałów dla polskiego enterprise — rejestry (KRS / RDF /
        MSiG / Zastawy), giełda (ESPI/EBI), regulacje (KSeF / NIS2 / DORA / AI
        Act / CSRD), nadzór (KNF / UODO / NIK), finansowanie, role C-suite,
        ekspansja, patenty. Zaznacz i aktywuj jednym kliknięciem.
      </p>

      {[...groups.entries()].map(([label, items]) => (
        <div key={label}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {label}
          </p>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {items.map((p) => {
              const checked = selected.has(p.key);
              return (
                <label
                  key={p.key}
                  className={
                    "flex cursor-pointer gap-3 rounded-lg border p-3 transition " +
                    (checked
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-200 hover:border-gray-300")
                  }
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(p.key)}
                    className="mt-1 h-4 w-4"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {p.name}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                        {TYPE_LABELS[p.type] ?? p.type}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        w:{p.score_weight}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-600">
                      {p.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      {err && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={activate}
          disabled={activating || selected.size === 0}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {activating
            ? "Aktywuję..."
            : `Aktywuj wybrane (${selected.size})`}
        </button>
        {selected.size > 0 && (
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm text-gray-600 hover:underline"
          >
            Wyczyść zaznaczenie
          </button>
        )}
      </div>
    </div>
  );
}
