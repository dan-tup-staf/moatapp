"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, Trash2, XCircle } from "lucide-react";

import { api, ApiError, Domain, DomainHealth } from "@/lib/api-client";

const CHECK_LABELS: { key: string; label: string }[] = [
  { key: "spf", label: "SPF" },
  { key: "dkim", label: "DKIM" },
  { key: "dmarc", label: "DMARC" },
  { key: "mx", label: "MX" },
];

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setDomains(await api.domains.list());
    } catch {
      setDomains([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    try {
      await api.domains.create(input);
      setInput("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd dodawania domeny");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: number, domain: string) {
    if (!window.confirm(`Usunąć domenę "${domain}"?`)) return;
    try {
      await api.domains.delete(id);
      await refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Błąd");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Domeny</h2>
        <p className="mt-1 text-sm text-gray-600">
          Sprawdź zdrowie domen wysyłkowych — SPF, DKIM, DMARC i MX decydują o
          tym, czy maile trafiają do skrzynki, czy do spamu.
        </p>
      </div>

      <form
        onSubmit={handleAdd}
        className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-4"
      >
        <input
          type="text"
          required
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="twojafirma.pl"
          className="min-w-[220px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
        <button
          type="submit"
          disabled={adding}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {adding ? "Dodaję..." : "Dodaj domenę"}
        </button>
        {error && (
          <p className="w-full rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Ładowanie...</p>
      ) : domains.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
          Brak domen. Dodaj pierwszą powyżej, np. domenę z której wysyłasz maile.
        </p>
      ) : (
        <div className="space-y-3">
          {domains.map((d) => (
            <DomainRow
              key={d.id}
              domain={d}
              onDelete={() => handleDelete(d.id, d.domain)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreRing({ pct }: { pct: number }) {
  const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
  const text =
    pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600";
  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${color} ${pct * 3.6}deg, #e5e7eb 0deg)` }}
      title={`Zdrowie domeny: ${pct}%`}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
        <span className={`text-[11px] font-bold ${text}`}>{pct}</span>
      </div>
    </div>
  );
}

function DomainRow({
  domain,
  onDelete,
}: {
  domain: Domain;
  onDelete: () => void;
}) {
  const [health, setHealth] = useState<DomainHealth | null>(null);
  const [checking, setChecking] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function runCheck() {
    setChecking(true);
    setErr(null);
    try {
      setHealth(await api.domains.health(domain.id));
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : "Błąd sprawdzania DNS");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain.id]);

  const healthy = health?.healthy ?? false;
  const pct = health
    ? Math.round((health.score / Math.max(1, health.max_score)) * 100)
    : 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {health && <ScoreRing pct={pct} />}
          <div>
            <span className="font-semibold text-gray-900">{domain.domain}</span>
            {health && (
              <span
                className={
                  "ml-2 rounded-full px-2 py-0.5 text-xs " +
                  (healthy
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800")
                }
              >
                {healthy
                  ? "Zdrowa"
                  : `${health.score}/${health.max_score} OK — wymaga uwagi`}
              </span>
            )}
            {checking && (
              <span className="ml-2 text-xs text-gray-400">sprawdzam DNS…</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={runCheck}
            disabled={checking}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 disabled:opacity-50"
          >
            <RefreshCw className={"h-3.5 w-3.5 " + (checking ? "animate-spin" : "")} />
            Sprawdź ponownie
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1 text-xs text-red-600 hover:underline"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Usuń
          </button>
        </div>
      </div>

      {err && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </p>
      )}

      {health && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CHECK_LABELS.map(({ key, label }) => {
            const c = health.checks[key];
            const ok = c?.ok ?? false;
            return (
              <div
                key={key}
                title={c?.detail}
                className={
                  "flex items-start gap-2 rounded-md border p-2 text-xs " +
                  (ok
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-amber-200 bg-amber-50")
                }
              >
                {ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                )}
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{label}</p>
                  <p className="truncate text-gray-500" title={c?.detail}>
                    {c?.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-xs text-gray-400">
        Brakujące rekordy dodajesz u rejestratora/dostawcy DNS. SPF i DKIM
        autoryzują nadawcę, DMARC mówi serwerom co robić z podszywaniem, MX
        odbiera pocztę.
      </p>
    </div>
  );
}
