"use client";

import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { api, ApiError, CrmProvider } from "@/lib/api-client";

export function CrmProvidersSection() {
  const [providers, setProviders] = useState<CrmProvider[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      setProviders(await api.crmIntegrations.providers());
    } catch {
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Integracje CRM</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Podłącz CRM jako cel sekwencji — leady, zadania i szanse sprzedaży
          trafią tam po osiągnięciu celu. Klucze zapisujemy zaszyfrowane.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        Status: szkielet. Możesz podłączyć klucze; do czasu uruchomienia
        natywnych wywołań API cele sekwencji pushują dane przez generyczny
        webhook (Integracje → Webhooki), więc działają już dziś.
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Ładowanie…</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {providers.map((p) => (
            <CrmCard key={p.key} provider={p} onChanged={refresh} />
          ))}
        </div>
      )}
    </section>
  );
}

function CrmCard({
  provider: p,
  onChanged,
}: {
  provider: CrmProvider;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [domain, setDomain] = useState(p.domain ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function connect() {
    if (!apiKey.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await api.crmIntegrations.connect(
        p.key,
        apiKey.trim(),
        p.needs_domain ? domain.trim() : undefined,
      );
      setApiKey("");
      setEditing(false);
      onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : "Błąd zapisu");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm(`Odłączyć ${p.name}?`)) return;
    await api.crmIntegrations.disconnect(p.key);
    onChanged();
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{p.name}</h3>
        {p.connected ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Podłączony
          </span>
        ) : (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
            Niepodłączony
          </span>
        )}
      </div>
      <p className="mt-1.5 text-xs text-gray-600">{p.description}</p>

      {p.connected && !editing ? (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <KeyRound className="h-3.5 w-3.5 text-gray-400" />
            <span className="font-mono">{p.key_masked}</span>
            {p.domain && <span className="text-gray-400">· {p.domain}</span>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(true)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
            >
              Zmień
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
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-gray-400">{p.key_hint}</p>
          {p.needs_domain && (
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="Domena / subdomena konta"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          )}
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Klucz / token API"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={connect}
              disabled={busy || !apiKey.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Podłącz
            </button>
            {editing && (
              <button
                onClick={() => setEditing(false)}
                className="text-sm text-gray-500 hover:text-gray-900"
              >
                Anuluj
              </button>
            )}
            <a
              href={p.docs_url}
              target="_blank"
              rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> API
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
