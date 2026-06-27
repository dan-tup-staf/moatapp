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

  async function testConn() {
    setBusy(true);
    try {
      const res = await api.emailAccounts.test(account.id);
      alert(
        res.ok
          ? `✅ ${res.detail}`
          : `❌ Test nieudany:\n${res.detail}`,
      );
      onChanged();
    } catch (e) {
      alert(e instanceof ApiError ? e.detail : "Błąd testu");
    } finally {
      setBusy(false);
    }
  }

  async function resume() {
    setBusy(true);
    try {
      await api.emailAccounts.update(account.id, { active: true });
      onChanged();
    } catch (e) {
      alert(e instanceof ApiError ? e.detail : "Błąd");
    } finally {
      setBusy(false);
    }
  }

  const warm = WARMUP[account.warmup_status];
  const conn = !account.active
    ? { cls: "bg-rose-50 text-rose-700", label: "Wstrzymana (odbicia)" }
    : account.has_password
      ? account.verified
        ? { cls: "bg-emerald-50 text-emerald-700", label: "Połączona" }
        : account.last_error
          ? { cls: "bg-red-50 text-red-600", label: "Błąd połączenia" }
          : { cls: "bg-amber-50 text-amber-700", label: "Niezweryfikowana" }
      : { cls: "bg-gray-100 text-gray-500", label: "Brak hasła" };

  return (
    <tr className={account.active ? "hover:bg-gray-50/60" : "bg-rose-50/30"}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{account.email}</span>
          <span
            title={account.last_error || undefined}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${conn.cls}`}
          >
            {conn.label}
          </span>
          {!account.active && (
            <button
              onClick={resume}
              disabled={busy}
              className="rounded-md border border-gray-300 px-2 py-0.5 text-[10px] font-medium hover:bg-gray-100 disabled:opacity-50"
            >
              Wznów
            </button>
          )}
        </div>
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
        <div className="flex items-center justify-end gap-1">
          {account.has_password && (
            <button
              onClick={testConn}
              disabled={busy}
              className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium hover:bg-gray-100 disabled:opacity-50"
              title="Wyślij testowy mail przez tę skrzynkę"
            >
              Test
            </button>
          )}
          <button
            onClick={remove}
            disabled={busy}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 disabled:opacity-50"
            title="Usuń"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
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

type SmtpSec = "starttls" | "ssl" | "none";

type Preset = {
  key: string;
  label: string;
  provider: string;
  host: string;
  port: number;
  security: SmtpSec;
  imapHost: string;
  instructions: { title: string; steps: string[]; link?: string };
};

const PRESETS: Preset[] = [
  {
    key: "gmail",
    label: "Gmail / Google Workspace",
    provider: "google",
    host: "smtp.gmail.com",
    port: 587,
    security: "starttls",
    imapHost: "imap.gmail.com",
    instructions: {
      title: "Jak podłączyć Gmail / Google Workspace",
      steps: [
        "Włącz weryfikację dwuetapową na koncie Google (wymagane).",
        "Wejdź na myaccount.google.com/apppasswords i wygeneruj „Hasło aplikacji” (App Password).",
        "Skopiuj 16-znakowy kod i wklej go poniżej jako hasło (nie zwykłe hasło do konta!).",
        "Login = Twój pełny adres Gmail. Host smtp.gmail.com, port 587, STARTTLS.",
      ],
      link: "https://myaccount.google.com/apppasswords",
    },
  },
  {
    key: "outlook",
    label: "Outlook / Microsoft 365",
    provider: "microsoft",
    host: "smtp.office365.com",
    port: 587,
    security: "starttls",
    imapHost: "outlook.office365.com",
    instructions: {
      title: "Jak podłączyć Outlook / Microsoft 365",
      steps: [
        "Włącz uwierzytelnianie wieloskładnikowe (MFA) na koncie Microsoft.",
        "Wygeneruj „Hasło aplikacji” w ustawieniach zabezpieczeń konta.",
        "Login = Twój pełny adres e-mail. Wklej hasło aplikacji poniżej.",
        "Host smtp.office365.com, port 587, STARTTLS. (W niektórych tenantach SMTP AUTH trzeba włączyć w panelu admina.)",
      ],
      link: "https://account.microsoft.com/security",
    },
  },
  {
    key: "custom",
    label: "Własny SMTP / inny dostawca",
    provider: "smtp",
    host: "",
    port: 587,
    security: "starttls",
    imapHost: "",
    instructions: {
      title: "Własny serwer SMTP",
      steps: [
        "Podaj host SMTP swojego dostawcy (np. smtp.twojafirma.pl).",
        "Port 587 = STARTTLS (najczęstszy), port 465 = SSL/TLS.",
        "Login to zwykle Twój pełny adres e-mail; hasło — hasło skrzynki lub hasło aplikacji.",
        "Po dodaniu kliknij „Wyślij test”, aby zweryfikować połączenie.",
      ],
    },
  },
];

function AddAccountForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [presetKey, setPresetKey] = useState("gmail");
  const preset = PRESETS.find((p) => p.key === presetKey) ?? PRESETS[0];

  const [email, setEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [smtpHost, setSmtpHost] = useState(preset.host);
  const [smtpPort, setSmtpPort] = useState(String(preset.port));
  const [security, setSecurity] = useState<SmtpSec>(preset.security);
  const [imapHost, setImapHost] = useState(preset.imapHost);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [dailyLimit, setDailyLimit] = useState("50");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickPreset(key: string) {
    setPresetKey(key);
    const p = PRESETS.find((x) => x.key === key);
    if (p) {
      setSmtpHost(p.host);
      setSmtpPort(String(p.port));
      setSecurity(p.security);
      setImapHost(p.imapHost);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const acc = await api.emailAccounts.create({
        email: email.trim(),
        from_name: fromName.trim() || null,
        provider: preset.provider,
        smtp_host: smtpHost.trim() || null,
        smtp_port: Number(smtpPort) || null,
        smtp_username: (username.trim() || email.trim()) || null,
        smtp_password: password || null,
        smtp_security: security,
        imap_host: imapHost.trim() || null,
        imap_port: 993,
        daily_limit: Number(dailyLimit) || 0,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      // Verify immediately so the user gets instant feedback.
      if (password) {
        try {
          const res = await api.emailAccounts.test(acc.id);
          if (!res.ok) {
            setError(
              `Skrzynka dodana, ale test się nie powiódł: ${res.detail}. Sprawdź login/hasło/host.`,
            );
            setSaving(false);
            onCreated();
            return;
          }
        } catch {
          // non-fatal — account is created, user can re-test from the list
        }
      }
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
      className="space-y-4 rounded-xl border-2 border-gray-900 bg-white p-4"
    >
      <div className="flex items-center gap-2">
        <Flame className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-gray-900">
          Podłącz skrzynkę wysyłkową
        </h3>
      </div>

      {/* Provider presets */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => pickPreset(p.key)}
            className={
              "rounded-lg border px-3 py-1.5 text-sm font-medium transition " +
              (presetKey === p.key
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 text-gray-700 hover:bg-gray-50")
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Instructions */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
        <p className="font-semibold">{preset.instructions.title}</p>
        <ol className="mt-1.5 list-decimal space-y-1 pl-4">
          {preset.instructions.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        {preset.instructions.link && (
          <a
            href={preset.instructions.link}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block font-medium underline"
          >
            Otwórz ustawienia →
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Adres e-mail *">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="kontakt@twojafirma.pl"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Nazwa nadawcy">
          <input
            type="text"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="Daniel z MOATION"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Host SMTP *">
          <input
            type="text"
            required
            value={smtpHost}
            onChange={(e) => setSmtpHost(e.target.value)}
            placeholder="smtp.gmail.com"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Port">
            <input
              type="number"
              value={smtpPort}
              onChange={(e) => setSmtpPort(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Szyfrowanie">
            <select
              value={security}
              onChange={(e) => setSecurity(e.target.value as SmtpSec)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="starttls">STARTTLS (587)</option>
              <option value="ssl">SSL/TLS (465)</option>
              <option value="none">Brak</option>
            </select>
          </Field>
        </div>
        <Field label="Login (zwykle e-mail)">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={email || "kontakt@twojafirma.pl"}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Hasło / hasło aplikacji *">
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            autoComplete="new-password"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Host IMAP (wykrywanie odpowiedzi)">
          <input
            type="text"
            value={imapHost}
            onChange={(e) => setImapHost(e.target.value)}
            placeholder="imap.gmail.com (opcjonalnie)"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Dzienny limit">
          <input
            type="number"
            min={0}
            value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Tagi (po przecinku)">
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="sprzedaż, PL"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <p className="text-xs text-gray-500">
        Hasło jest szyfrowane przy zapisie. Po dodaniu wyślemy testowy mail na
        Twój adres, aby potwierdzić, że wysyłka działa. Podaj host IMAP, aby
        MOATION wykrywał odpowiedzi i automatycznie wstrzymywał follow-upy (port
        993, te same login i hasło co SMTP).
      </p>

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
          {saving ? "Łączę i testuję…" : "Podłącz i przetestuj"}
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
        {label}
      </label>
      {children}
    </div>
  );
}
