"use client";

import {
  CheckCircle2,
  Database,
  ExternalLink,
  KeyRound,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { api, ApiError, EnrichmentProvider } from "@/lib/api-client";

export default function EnrichmentPage() {
  const [providers, setProviders] = useState<EnrichmentProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setProviders(await api.enrichment.providers());
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Błąd ładowania");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Ładowanie…</p>;
  if (error)
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Database className="h-6 w-6 text-indigo-600" />
          Wzbogacanie danych
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Podłącz dostawców danych B2B, by uzupełniać e-maile i telefony do firm
          i osób znalezionych filtrami. Podaj klucz API — zapiszemy go
          zaszyfrowany.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong>Status: szkielet integracji.</strong> Możesz już podłączyć
          klucze API. Sam mechanizm wzbogacania (pobieranie maili/telefonów)
          dokończymy, gdy przekażesz klucz i uruchomimy połączenie — wtedy
          pojawi się akcja „Wzbogać” na listach i w wyszukiwarce prospektów.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {providers.map((p) => (
          <ProviderCard key={p.key} provider={p} onChanged={refresh} />
        ))}
      </div>
    </div>
  );
}

function ProviderCard({
  provider: p,
  onChanged,
}: {
  provider: EnrichmentProvider;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function connect() {
    if (!apiKey.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.enrichment.connect(p.key, apiKey.trim());
      setApiKey("");
      setEditing(false);
      onChanged();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.detail : "Błąd zapisu");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm(`Odłączyć ${p.name}?`)) return;
    await api.enrichment.disconnect(p.key);
    onChanged();
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.enrichment.test(p.key);
      setMsg(r.message);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.detail : "Błąd");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{p.name}</h3>
        {p.connected ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Podłączony
          </span>
        ) : (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
            Niepodłączony
          </span>
        )}
      </div>

      <p className="mt-2 text-sm text-gray-600">{p.description}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {p.capabilities.map((c) => (
          <span
            key={c}
            className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600"
          >
            {c}
          </span>
        ))}
      </div>

      <div className="mt-4 flex-1" />

      {p.connected && !editing ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <KeyRound className="h-3.5 w-3.5 text-gray-400" />
            Klucz: <span className="font-mono">{p.key_masked}</span>
          </div>
          {msg && (
            <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
              {msg}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={test}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Sprawdź status
            </button>
            <button
              onClick={() => setEditing(true)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
            >
              Zmień klucz
            </button>
            <button
              onClick={disconnect}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Odłącz
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-gray-400">{p.key_hint}</p>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Wklej klucz API"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {msg && <p className="text-xs text-red-600">{msg}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={connect}
              disabled={busy || !apiKey.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {p.connected ? "Zapisz nowy klucz" : "Podłącz"}
            </button>
            {editing && (
              <button
                onClick={() => {
                  setEditing(false);
                  setApiKey("");
                }}
                className="rounded-md px-3 py-2 text-sm text-gray-500 hover:text-gray-900"
              >
                Anuluj
              </button>
            )}
          </div>
        </div>
      )}

      <a
        href={p.docs_url}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
      >
        <ExternalLink className="h-3 w-3" /> Dokumentacja API
      </a>
    </div>
  );
}
