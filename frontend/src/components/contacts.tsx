"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import {
  api,
  ApiError,
  CompanyRow,
  IcpProfile,
  IcpQA,
  LeadList,
  PersonRow,
  SourceType,
  SuggestedSource,
} from "@/lib/api-client";

// ---------- Listy panel ----------

export function ListsPanel() {
  const [lists, setLists] = useState<LeadList[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      setLists(await api.lists.list());
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
      await api.lists.create({
        name,
        description: description || undefined,
      });
      setName("");
      setDescription("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd tworzenia");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (
      !window.confirm(
        `Usunąć listę "${name}" razem ze wszystkimi jej leadami?`,
      )
    )
      return;
    try {
      await api.lists.delete(id);
      await refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Błąd usuwania");
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleCreate}
        className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
      >
        <h3 className="text-sm font-medium text-gray-700">Nowa lista</h3>
        <input
          type="text"
          required
          maxLength={255}
          placeholder="Nazwa listy *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
        <input
          type="text"
          placeholder="Opis (opcjonalnie)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
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
          {creating ? "Tworzenie..." : "Utwórz listę"}
        </button>
      </form>

      <div className="rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Ładowanie...</p>
        ) : lists.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">
            Brak list. Utwórz pierwszą powyżej.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {lists.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/lists/${l.id}`}
                    className="font-medium text-gray-900 hover:underline"
                  >
                    {l.name}
                  </Link>
                  {l.description && (
                    <p className="mt-0.5 text-sm text-gray-500">
                      {l.description}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    {l.leads_count} {l.leads_count === 1 ? "lead" : "leadów"} •
                    utworzona{" "}
                    {new Date(l.created_at).toLocaleDateString("pl-PL")}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(l.id, l.name)}
                  className="ml-4 text-sm text-red-600 hover:underline"
                >
                  Usuń
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------- Firmy panel ----------

type SortCompanies = "score" | "leads" | "signals" | "recent";

export function CompaniesPanel() {
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortCompanies>("score");

  useEffect(() => {
    (async () => {
      try {
        setRows(await api.companies.list());
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : "Błąd ładowania");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sorted = [...rows].sort((a, b) => {
    if (sort === "score") return b.total_score - a.total_score;
    if (sort === "leads") return b.leads_count - a.leads_count;
    if (sort === "signals") return b.signals_count - a.signals_count;
    // recent
    const aT = a.last_message_sent_at
      ? new Date(a.last_message_sent_at).getTime()
      : 0;
    const bT = b.last_message_sent_at
      ? new Date(b.last_message_sent_at).getTime()
      : 0;
    return bT - aT;
  });

  if (loading) return <p className="text-sm text-gray-500">Ładowanie...</p>;
  if (error)
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {rows.length}{" "}
          {rows.length === 1 ? "firma" : rows.length < 5 ? "firmy" : "firm"}
        </p>
        <FilterGroup
          label="Sort"
          value={sort}
          onChange={(v) => setSort(v as SortCompanies)}
          options={[
            { value: "score", label: "Score" },
            { value: "leads", label: "Liczba osób" },
            { value: "signals", label: "Sygnały" },
            { value: "recent", label: "Ostatnia akt." },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
          Brak firm — dodaj leadów z polem „firma" w sekcji Listy, a pojawią
          się tutaj zagregowane.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Firma
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">
                  Osoby
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Status
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">
                  Sygnały
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">
                  Aktywnych
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Ostatni mail
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">
                  Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sorted.map((c) => (
                <tr key={c.company} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">
                    {c.company}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700">
                    {c.leads_count}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={c.highest_status} />
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700">
                    {c.signals_count}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700">
                    {c.active_enrollments}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {c.last_message_sent_at
                      ? new Date(c.last_message_sent_at).toLocaleDateString(
                          "pl-PL",
                        )
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-gray-900">
                    {c.total_score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- Osoby panel ----------

type SortPeople = "score" | "recent" | "name" | "signals";

export function PeoplePanel() {
  const [rows, setRows] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortPeople>("score");
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setRows(await api.people.list());
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : "Błąd ładowania");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = rows.filter((p) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      p.email.toLowerCase().includes(q) ||
      (p.first_name?.toLowerCase().includes(q) ?? false) ||
      (p.last_name?.toLowerCase().includes(q) ?? false) ||
      (p.company?.toLowerCase().includes(q) ?? false) ||
      (p.title?.toLowerCase().includes(q) ?? false)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "score") return b.score - a.score;
    if (sort === "signals") return b.signals_count - a.signals_count;
    if (sort === "name") {
      const an = `${a.last_name ?? ""} ${a.first_name ?? ""}`.trim() || a.email;
      const bn = `${b.last_name ?? ""} ${b.first_name ?? ""}`.trim() || b.email;
      return an.localeCompare(bn, "pl");
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (loading) return <p className="text-sm text-gray-500">Ładowanie...</p>;
  if (error)
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          placeholder="Szukaj: email, imię, firma, stanowisko..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-[240px] rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
        <FilterGroup
          label="Sort"
          value={sort}
          onChange={(v) => setSort(v as SortPeople)}
          options={[
            { value: "score", label: "Score" },
            { value: "recent", label: "Dodane" },
            { value: "name", label: "Nazwisko" },
            { value: "signals", label: "Sygnały" },
          ]}
        />
      </div>
      <p className="text-xs text-gray-500">
        Pokazuję {sorted.length} z {rows.length}
      </p>

      {sorted.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
          {rows.length === 0
            ? "Brak osób — dodaj leadów do listy w sekcji Listy."
            : "Brak wyników dla filtra."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Osoba
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Firma / stanowisko
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
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Ostatni mail
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">
                  Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sorted.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="text-gray-900">{p.email}</div>
                    {(p.first_name || p.last_name) && (
                      <div className="text-xs text-gray-500">
                        {[p.first_name, p.last_name]
                          .filter(Boolean)
                          .join(" ")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="text-gray-900">{p.company ?? "—"}</div>
                    {p.title && (
                      <div className="text-xs text-gray-500">{p.title}</div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    <Link
                      href={`/lists/${p.list_id}`}
                      className="hover:underline"
                    >
                      {p.list_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700">
                    {p.signals_count}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {p.last_message_sent_at
                      ? new Date(p.last_message_sent_at).toLocaleDateString(
                          "pl-PL",
                        )
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-gray-900">
                    {p.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- ICP panel ----------

export function IcpPanel() {
  const [icp, setIcp] = useState<IcpProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [url, setUrl] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [useManual, setUseManual] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [qa, setQa] = useState<IcpQA[]>([]);
  const [synthesizing, setSynthesizing] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.icp.get();
        setIcp(data);
        if (data?.qa_history?.length) setQa(data.qa_history);
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : "Błąd");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleAnalyze(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAnalyzing(true);
    try {
      const payload = useManual
        ? { manual_description: manualDescription }
        : { url };
      const res = await api.icp.analyzeUrl(payload);
      const newQa = res.suggested_questions.map((q) => ({
        question: q,
        answer: "",
      }));
      setQa(newQa);
      const fresh = await api.icp.get();
      setIcp(fresh);
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.detail
        : `Nie udało się połączyć z API (możliwe uśpienie serwera lub przekroczony czas — analiza AI bywa wolna; spróbuj jeszcze raz za chwilę). Szczegóły: ${
            err instanceof Error ? err.message : String(err)
          }`;
      setError(msg);
      // 400 = scraping failed → automatycznie zasugeruj ręczny opis
      if (
        err instanceof ApiError &&
        err.status === 400 &&
        !useManual &&
        msg.includes("pobrać")
      ) {
        setUseManual(true);
      }
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSynthesize() {
    setError(null);
    setSynthesizing(true);
    try {
      const fresh = await api.icp.synthesize(qa);
      setIcp(fresh);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd syntezy");
    } finally {
      setSynthesizing(false);
    }
  }

  async function handleSaveFields(patch: Record<string, unknown>) {
    setSaving(true);
    try {
      const fresh = await api.icp.updateFields(patch);
      setIcp(fresh);
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Błąd");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!window.confirm("Wyczyścić cały ICP i zacząć od zera?")) return;
    await api.icp.delete();
    setIcp(null);
    setQa([]);
    setUrl("");
  }

  if (loading) return <p className="text-sm text-gray-500">Ładowanie...</p>;

  const hasScraped = !!icp?.scraped_summary;
  const hasIcp =
    icp?.icp_fields &&
    (icp.icp_fields.target_industries.length > 0 ||
      icp.icp_fields.buyer_persona_titles.length > 0 ||
      icp.icp_fields.company_size);

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {!hasScraped ? (
        // Stage 1: Empty — URL lub manual description
        <form
          onSubmit={handleAnalyze}
          className="space-y-3 rounded-lg border border-gray-200 bg-white p-6"
        >
          <h3 className="text-sm font-medium text-gray-700">
            Krok 1/3 — Powiedz o swojej firmie
          </h3>

          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setUseManual(false)}
              className={
                "rounded-full px-3 py-1 transition " +
                (useManual
                  ? "text-gray-600 hover:text-gray-900"
                  : "bg-gray-900 text-white")
              }
            >
              Link do strony
            </button>
            <button
              type="button"
              onClick={() => setUseManual(true)}
              className={
                "rounded-full px-3 py-1 transition " +
                (useManual
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:text-gray-900")
              }
            >
              Opis ręczny
            </button>
          </div>

          {useManual ? (
            <>
              <p className="text-xs text-gray-500">
                Użyj dla firm niewidocznych w internecie albo gdy LLM research
                nie znalazł informacji. Opisz firmę w 3-6 zdaniach — co
                robicie, komu sprzedajecie, czym się wyróżniacie.
              </p>
              <textarea
                required
                rows={6}
                placeholder="Np. Staffly to platforma do testów rekrutacyjnych dla zespołów HR w średnich firmach..."
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                Podaj link — AI przeszuka internet (strona, LinkedIn, news,
                katalogi) i zbierze info o firmie. Jeśli firma jest niewidoczna
                / AI nie znajdzie — przełącz na „Opis ręczny".
              </p>
              <input
                type="url"
                required
                placeholder="https://twoja-firma.pl"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </>
          )}

          <button
            type="submit"
            disabled={
              analyzing ||
              (useManual
                ? manualDescription.trim().length < 20
                : !url.trim())
            }
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {analyzing ? "Analizuję..." : "Analizuj"}
          </button>
        </form>
      ) : !hasIcp ? (
        // Stage 2: Questions
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-600">
            <p className="mb-1 font-medium text-gray-700">
              Krok 2/3 — odpowiedz na pytania
            </p>
            <p>
              Strona:{" "}
              <a
                href={icp!.source_url!}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {icp!.source_url}
              </a>
            </p>
          </div>

          <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
            {qa.map((pair, i) => (
              <div key={i}>
                <p className="mb-1 text-sm font-medium text-gray-800">
                  {i + 1}. {pair.question}
                </p>
                <textarea
                  value={pair.answer}
                  onChange={(e) => {
                    const next = [...qa];
                    next[i] = { ...next[i], answer: e.target.value };
                    setQa(next);
                  }}
                  rows={3}
                  placeholder="Odpowiedz własnymi słowami..."
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSynthesize}
              disabled={
                synthesizing ||
                qa.every((p) => !p.answer.trim())
              }
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {synthesizing ? "Syntezuję..." : "Wygeneruj ICP →"}
            </button>
            <button
              onClick={handleReset}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-100"
            >
              Zacznij od nowa
            </button>
          </div>
        </div>
      ) : (
        // Stage 3: Editable ICP + dedicated-signals discovery
        <>
          <IcpEditor
            icp={icp!}
            saving={saving}
            onSave={handleSaveFields}
            onReset={handleReset}
            onRegenerate={handleSynthesize}
            regenerating={synthesizing}
            qa={qa}
          />
          <DiscoveryPanel />
        </>
      )}
    </div>
  );
}

// ---------- Discovery: dedicated signal sources from ICP ----------

const CHANNEL_LABELS: Record<SourceType, string> = {
  rss: "RSS",
  pracuj_pl: "pracuj.pl",
  linkedin: "LinkedIn",
  google_news: "Google News",
  x_twitter: "X / Twitter",
  serp: "SERP",
  funding: "Bazy fundingowe",
  company_site: "Strona firmowa",
};

function DiscoveryPanel() {
  const [suggestions, setSuggestions] = useState<SuggestedSource[] | null>(
    null,
  );
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setDoneMsg(null);
    try {
      const res = await api.icp.suggestSources();
      setSuggestions(res.sources);
      // pre-select all by default
      setSelected(new Set(res.sources.map((_, i) => i)));
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd generowania");
    } finally {
      setLoading(false);
    }
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function activate() {
    if (!suggestions) return;
    const chosen = suggestions.filter((_, i) => selected.has(i));
    if (chosen.length === 0) return;
    setActivating(true);
    setError(null);
    try {
      await api.signalSources.createBatch(
        chosen.map((s) => ({
          name: s.name,
          type: s.type,
          config: { query: s.query, max_results: s.max_results },
          score_weight: s.score_weight,
        })),
      );
      setDoneMsg(
        `Aktywowano ${chosen.length} dedykowanych źródeł sygnałów. Zobacz sekcję „Źródła sygnałów".`,
      );
      setSuggestions(null);
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd aktywacji");
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Dedykowane źródła sygnałów
          </h3>
          <p className="mt-0.5 text-xs text-gray-600">
            Na podstawie Twojego ICP wygenerujemy gotowe zapytania per kanał
            (LinkedIn, Google News, SERP, funding…). Przejrzyj, odznacz zbędne i
            aktywuj — worker zacznie zbierać sygnały dopasowane do tej firmy.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="shrink-0 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading
            ? "Generuję…"
            : suggestions
              ? "Przegeneruj"
              : "Wygeneruj plan sygnałów"}
        </button>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {doneMsg && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {doneMsg}
        </p>
      )}

      {suggestions && suggestions.length === 0 && (
        <p className="text-sm text-gray-500">
          Brak propozycji — uzupełnij ICP (branże, triggery) i spróbuj ponownie.
        </p>
      )}

      {suggestions && suggestions.length > 0 && (
        <>
          <div className="space-y-2">
            {suggestions.map((s, i) => {
              const checked = selected.has(i);
              return (
                <label
                  key={i}
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
                    onChange={() => toggle(i)}
                    className="mt-1 h-4 w-4"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {s.name}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                        {CHANNEL_LABELS[s.type] ?? s.type}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        w:{s.score_weight}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate font-mono text-xs text-gray-500">
                      {s.query}
                    </p>
                    {s.rationale && (
                      <p className="mt-0.5 text-xs text-gray-600">
                        {s.rationale}
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
          <button
            onClick={activate}
            disabled={activating || selected.size === 0}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {activating
              ? "Aktywuję…"
              : `Aktywuj wybrane źródła (${selected.size})`}
          </button>
        </>
      )}
    </div>
  );
}

function IcpEditor({
  icp,
  saving,
  onSave,
  onReset,
  onRegenerate,
  regenerating,
  qa,
}: {
  icp: IcpProfile;
  saving: boolean;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
  onReset: () => Promise<void>;
  onRegenerate: () => Promise<void>;
  regenerating: boolean;
  qa: IcpQA[];
}) {
  const f = icp.icp_fields;
  const [industries, setIndustries] = useState(f.target_industries.join(", "));
  const [companySize, setCompanySize] = useState(f.company_size);
  const [buyerTitles, setBuyerTitles] = useState(
    f.buyer_persona_titles.join(", "),
  );
  const [painPoints, setPainPoints] = useState(f.pain_points.join("\n"));
  const [triggers, setTriggers] = useState(f.triggers.join("\n"));
  const [notes, setNotes] = useState(f.notes);

  const [showQa, setShowQa] = useState(false);

  function splitCsv(s: string): string[] {
    return s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }
  function splitLines(s: string): string[] {
    return s
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  async function handleSave() {
    await onSave({
      target_industries: splitCsv(industries),
      company_size: companySize,
      buyer_persona_titles: splitCsv(buyerTitles),
      pain_points: splitLines(painPoints),
      triggers: splitLines(triggers),
      notes,
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
        <p className="font-medium">✓ Krok 3/3 — ICP wygenerowane</p>
        <p className="mt-1">
          Edytuj dowolne pole, kliknij „Zapisz". Możesz też przegenerować
          syntezę z nowymi odpowiedziami.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        <Field
          label="Target branże (przecinek)"
          value={industries}
          onChange={setIndustries}
        />
        <Field
          label="Wielkość firmy"
          value={companySize}
          onChange={setCompanySize}
          placeholder="np. 50-500 pracowników"
        />
        <Field
          label="Buyer persona — stanowiska (przecinek)"
          value={buyerTitles}
          onChange={setBuyerTitles}
        />
        <FieldArea
          label="Pain points (każdy w nowej linii)"
          value={painPoints}
          onChange={setPainPoints}
          rows={4}
        />
        <FieldArea
          label="Triggery kupowe (sygnały — każdy w nowej linii)"
          value={triggers}
          onChange={setTriggers}
          rows={4}
        />
        <FieldArea
          label="Dodatkowe notatki"
          value={notes}
          onChange={setNotes}
          rows={3}
        />

        <div className="flex flex-wrap gap-3 border-t border-gray-200 pt-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "Zapisuję..." : "Zapisz zmiany"}
          </button>
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
          >
            {regenerating ? "Generuję..." : "Przegeneruj z LLM"}
          </button>
          <button
            onClick={() => setShowQa(!showQa)}
            className="ml-auto text-xs text-gray-500 hover:text-gray-900 underline"
          >
            {showQa ? "Ukryj" : "Pokaż"} pytania/odpowiedzi
          </button>
          <button
            onClick={onReset}
            className="text-xs text-red-600 hover:underline"
          >
            Reset całego ICP
          </button>
        </div>
      </div>

      {showQa && (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
          {qa.map((p, i) => (
            <div key={i}>
              <p className="text-xs font-medium text-gray-700">
                {i + 1}. {p.question}
              </p>
              <p className="mt-0.5 text-sm text-gray-900 whitespace-pre-wrap">
                {p.answer || <span className="text-gray-400">—</span>}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </div>
  );
}

function FieldArea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </div>
  );
}

// ---------- Shared small components ----------

const STATUS_COLORS: Record<string, string> = {
  new: "bg-gray-100 text-gray-700",
  contacted: "bg-blue-100 text-blue-800",
  replied: "bg-emerald-100 text-emerald-800",
  bounced: "bg-red-100 text-red-800",
  unsubscribed: "bg-yellow-100 text-yellow-800",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${cls}`}>{status}</span>
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase text-gray-500">
        {label}
      </span>
      <div className="flex rounded-md border border-gray-300 text-xs">
        {options.map((opt, i) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={
              "px-2.5 py-1 transition " +
              (value === opt.value
                ? "bg-gray-900 text-white"
                : "text-gray-700 hover:bg-gray-100") +
              (i > 0 ? " border-l border-gray-300" : "")
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
