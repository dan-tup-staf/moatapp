"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  CheckCircle2,
  Flame,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from "lucide-react";

import {
  api,
  ApiError,
  EmailAccount,
  EmailAccountSetup,
  EmailStatus,
  WarmupStatus,
} from "@/lib/api-client";

const WARMUP: Record<WarmupStatus, { label: string; cls: string; dot: string }> = {
  off: { label: "Wyłączone", cls: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
  warming: { label: "Rozgrzewanie", cls: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  ready: { label: "Gotowa", cls: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500" },
  paused: { label: "Pauza", cls: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
};

const DNS_KEYS = ["spf", "dkim", "dmarc", "mx"];

export default function DeliverabilityPage() {
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function refresh() {
    try {
      const [s, a] = await Promise.all([
        api.email.status().catch(() => null),
        api.emailAccounts.list().catch(() => []),
      ]);
      setStatus(s);
      setAccounts(a);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const configured = status?.configured ?? false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dostarczalność</h2>
          <p className="mt-1 text-sm text-gray-600">
            Skrzynki wysyłkowe, ich Setup Score (SPF/DKIM/DMARC/MX), status
            rozgrzewania i limity dzienne.
          </p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" /> Dodaj skrzynkę
        </button>
      </div>

      {/* Global SMTP transport status (env-configured) */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Transport SMTP (globalny)
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
              {configured ? "Podłączony" : "Nie skonfigurowany"}
            </span>
          )}
        </div>
        {!loading && status && (
          <p className="mt-2 text-xs text-gray-500">
            Host:{" "}
            <span className="font-mono">
              {status.host || "—"}:{status.port || "—"}
            </span>{" "}
            · Szyfrowanie:{" "}
            {status.use_tls ? "TLS" : status.starttls ? "STARTTLS" : "brak"} ·
            Dzienny limit: {status.daily_limit || "∞"}
          </p>
        )}
        <p className="mt-2 text-xs text-gray-500">
          Wysyłka leci przez ten transport (env na moation-api). Skrzynki poniżej
          opisują nadawców i ich zdrowie; rotacja nadawców — wkrótce.
        </p>
      </div>

      {showAdd && (
        <AddAccountForm
          onCreated={() => {
            setShowAdd(false);
            refresh();
          }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Ładowanie…</p>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-gray-700">
            Brak skrzynek wysyłkowych
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Dodaj skrzynkę, aby zobaczyć jej Setup Score i status DNS.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3">Nadawca</th>
                <th className="px-4 py-3">Setup Score</th>
                <th className="px-4 py-3">DNS</th>
                <th className="px-4 py-3">Rozgrzewanie</th>
                <th className="px-4 py-3">Limit / dzień</th>
                <th className="px-4 py-3">Tagi</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.map((a) => (
                <AccountRow key={a.id} account={a} onChanged={refresh} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const text =
    score >= 80
      ? "text-emerald-600"
      : score >= 50
        ? "text-amber-600"
        : "text-red-600";
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${color} ${score * 3.6}deg, #e5e7eb 0deg)` }}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
        <span className={`text-xs font-bold ${text}`}>{score}</span>
      </div>
    </div>
  );
}

function AccountRow({
  account,
  onChanged,
}: {
  account: EmailAccount;
  onChanged: () => void;
}) {
  const [setup, setSetup] = useState<EmailAccountSetup | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadSetup() {
    setChecking(true);
    try {
      setSetup(await api.emailAccounts.setup(account.id));
    } catch {
      setSetup(null);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    loadSetup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id]);

  async function cycleWarmup() {
    const order: WarmupStatus[] = ["off", "warming", "ready", "paused"];
    const next = order[(order.indexOf(account.warmup_status) + 1) % order.length];
    setBusy(true);
    try {
      await api.emailAccounts.update(account.id, { warmup_status: next });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Usunąć skrzynkę ${account.email}?`)) return;
    setBusy(true);
    try {
      await api.emailAccounts.delete(account.id);
      onChanged();
    } catch (e) {
      alert(e instanceof ApiError ? e.detail : "Błąd");
    } finally {
      setBusy(false);
    }
  }

  const warm = WARMUP[account.warmup_status];

  return (
    <tr className="hover:bg-gray-50/60">
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900">{account.email}</div>
        <div className="text-xs text-gray-500">
          {account.from_name || "— brak nazwy nadawcy —"}
          {account.smtp_host && (
            <span className="ml-1 text-gray-400">· {account.smtp_host}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {checking ? (
            <span className="text-xs text-gray-400">
              <RefreshCw className="inline h-3.5 w-3.5 animate-spin" /> licz…
            </span>
          ) : setup ? (
            <>
              <ScoreRing score={setup.score} />
              <button
                onClick={loadSetup}
                className="text-gray-300 hover:text-gray-600"
                title="Przelicz"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {DNS_KEYS.map((k) => {
            const c = setup?.checks[k];
            const ok = c?.ok ?? false;
            return (
              <span
                key={k}
                title={c?.detail}
                className={
                  "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase " +
                  (ok
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-600")
                }
              >
                {ok ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                {k}
              </span>
            );
          })}
        </div>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={cycleWarmup}
          disabled={busy}
          title="Kliknij, by zmienić status rozgrzewania"
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${warm.cls} disabled:opacity-50`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${warm.dot}`} />
          {warm.label}
        </button>
      </td>
      <td className="px-4 py-3">
        <DailyLimitEditor account={account} onChanged={onChanged} />
      </td>
      <td className="px-4 py-3">
        {account.tags.length === 0 ? (
          <span className="text-xs text-gray-400">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {account.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={remove}
          disabled={busy}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 disabled:opacity-50"
          title="Usuń"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

function DailyLimitEditor({
  account,
  onChanged,
}: {
  account: EmailAccount;
  onChanged: () => void;
}) {
  const [val, setVal] = useState(String(account.daily_limit));
  const [saving, setSaving] = useState(false);

  async function commit() {
    const n = Number(val);
    if (!Number.isFinite(n) || n === account.daily_limit) {
      setVal(String(account.daily_limit));
      return;
    }
    setSaving(true);
    try {
      await api.emailAccounts.update(account.id, { daily_limit: n });
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <input
      type="number"
      min={0}
      value={val}
      disabled={saving}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-gray-500 focus:outline-none"
    />
  );
}

function AddAccountForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [provider, setProvider] = useState("smtp");
  const [smtpHost, setSmtpHost] = useState("");
  const [dailyLimit, setDailyLimit] = useState("50");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.emailAccounts.create({
        email: email.trim(),
        from_name: fromName.trim() || null,
        provider,
        smtp_host: smtpHost.trim() || null,
        daily_limit: Number(dailyLimit) || 0,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd dodawania skrzynki");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-xl border-2 border-gray-900 bg-white p-4"
    >
      <div className="flex items-center gap-2">
        <Flame className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-gray-900">
          Nowa skrzynka wysyłkowa
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
            Adres e-mail *
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="kontakt@twojafirma.pl"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
            Nazwa nadawcy
          </label>
          <input
            type="text"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="Daniel z MOATION"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
            Dostawca
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="smtp">SMTP</option>
            <option value="google">Google Workspace</option>
            <option value="microsoft">Microsoft 365</option>
            <option value="other">Inny</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
            Host SMTP
          </label>
          <input
            type="text"
            value={smtpHost}
            onChange={(e) => setSmtpHost(e.target.value)}
            placeholder="smtp.twojafirma.pl"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
            Dzienny limit
          </label>
          <input
            type="number"
            min={0}
            value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
            Tagi (po przecinku)
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="sprzedaż, PL"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          disabled={saving}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? "Dodaję…" : "Dodaj skrzynkę"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
        >
          Anuluj
        </button>
      </div>
    </form>
  );
}
