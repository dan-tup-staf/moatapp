"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Plus,
  ShieldAlert,
  Trash2,
  XCircle,
} from "lucide-react";

import { api, ApiError, LinkedInAccount } from "@/lib/api-client";

export default function LinkedInPage() {
  const [accounts, setAccounts] = useState<LinkedInAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function refresh() {
    try {
      setAccounts(await api.linkedinAccounts.list());
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">LinkedIn</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Podłącz profil LinkedIn, aby kroki LinkedIn w sekwencjach (zaproszenia
            i wiadomości) szły automatycznie — mechanizmem jak HeyReach / lemlist
            (wewnętrzne API LinkedIn „Voyager", napędzane Twoją sesją).
          </p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" />
          {showAdd ? "Anuluj" : "Podłącz profil"}
        </button>
      </div>

      {/* Risk warning */}
      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="font-medium">Zanim podłączysz — przeczytaj</p>
          <p className="mt-1 text-xs text-amber-800">
            Automatyzacja LinkedIn działa na Twojej sesji i jest niezgodna z
            regulaminem LinkedIn — istnieje ryzyko ograniczenia konta. Trzymaj
            limity dzienne nisko (20 zaproszeń / 40 wiadomości), najlepiej użyj
            dedykowanego proxy/IP. Podłączaj tylko konto, którym masz prawo
            sterować.
          </p>
        </div>
      </div>

      {showAdd && (
        <AddLinkedInForm
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
          <Briefcase className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">
            Brak podłączonych profili LinkedIn
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Kliknij „Podłącz profil" i postępuj wg instrukcji, aby aktywować
            kroki LinkedIn w sekwencjach.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((a) => (
            <AccountCard key={a.id} account={a} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS = {
  connected: {
    cls: "bg-emerald-50 text-emerald-700",
    label: "Połączony",
    icon: CheckCircle2,
  },
  error: { cls: "bg-red-50 text-red-600", label: "Błąd", icon: XCircle },
  disconnected: {
    cls: "bg-gray-100 text-gray-500",
    label: "Niezweryfikowany",
    icon: AlertTriangle,
  },
} as const;

function AccountCard({
  account,
  onChanged,
}: {
  account: LinkedInAccount;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const s = STATUS[account.status];
  const Icon = s.icon;

  async function test() {
    setBusy(true);
    try {
      const res = await api.linkedinAccounts.test(account.id);
      alert(res.ok ? `✅ ${res.detail}` : `❌ ${res.detail}`);
      onChanged();
    } catch (e) {
      alert(e instanceof ApiError ? e.detail : "Błąd testu");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Odłączyć ten profil LinkedIn?")) return;
    setBusy(true);
    try {
      await api.linkedinAccounts.delete(account.id);
      onChanged();
    } catch (e) {
      alert(e instanceof ApiError ? e.detail : "Błąd");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">
                {account.name || "Profil LinkedIn"}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}
              >
                <Icon className="h-3 w-3" />
                {s.label}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Limity: {account.daily_limit_invites} zaproszeń ·{" "}
              {account.daily_limit_messages} wiadomości / dzień
              {account.proxy_url ? " · proxy ✓" : ""}
            </p>
            {account.last_error && account.status === "error" && (
              <p className="mt-0.5 max-w-md truncate text-xs text-red-600">
                {account.last_error}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={test}
            disabled={busy}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-100 disabled:opacity-50"
          >
            Testuj połączenie
          </button>
          <button
            onClick={remove}
            disabled={busy}
            title="Odłącz"
            className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function AddLinkedInForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [liAt, setLiAt] = useState("");
  const [jsession, setJsession] = useState("");
  const [proxy, setProxy] = useState("");
  const [invites, setInvites] = useState("20");
  const [messages, setMessages] = useState("40");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const acc = await api.linkedinAccounts.create({
        name: name.trim() || null,
        li_at: liAt.trim(),
        jsessionid: jsession.trim(),
        proxy_url: proxy.trim() || null,
        daily_limit_invites: Number(invites) || 0,
        daily_limit_messages: Number(messages) || 0,
      });
      try {
        const res = await api.linkedinAccounts.test(acc.id);
        if (!res.ok)
          setError(`Profil dodany, ale test nieudany: ${res.detail}`);
      } catch {
        /* non-fatal */
      }
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd podłączania");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-xl border-2 border-gray-900 bg-white p-4"
    >
      <h3 className="text-sm font-semibold text-gray-900">
        Podłącz profil LinkedIn
      </h3>

      {/* Instructions */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
        <p className="font-semibold">
          Jak pobrać cookie sesji (li_at + JSESSIONID)
        </p>
        <ol className="mt-1.5 list-decimal space-y-1 pl-4">
          <li>Zaloguj się na linkedin.com w przeglądarce (najlepiej Chrome).</li>
          <li>
            Otwórz DevTools (F12) → zakładka <b>Application</b> → po lewej{" "}
            <b>Cookies</b> → <b>https://www.linkedin.com</b>.
          </li>
          <li>
            Skopiuj wartość cookie <b>li_at</b> i wklej do pola „li_at" poniżej.
          </li>
          <li>
            Skopiuj wartość cookie <b>JSESSIONID</b> (zwykle zaczyna się od{" "}
            <code className="rounded bg-white/60 px-1">ajax:</code>) i wklej do
            pola „JSESSIONID".
          </li>
          <li>
            (Zalecane) Podaj dedykowane proxy, aby sesja działała ze stałego IP.
          </li>
        </ol>
        <p className="mt-2 text-[11px] text-blue-700">
          Cookie są szyfrowane przy zapisie. Po dodaniu zweryfikujemy sesję
          (wywołanie LinkedIn /me).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <L label="Nazwa (opcjonalnie)">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Daniel — profil firmowy"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </L>
        <L label="Proxy (opcjonalnie)">
          <input
            value={proxy}
            onChange={(e) => setProxy(e.target.value)}
            placeholder="http://user:pass@host:port"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </L>
        <L label="li_at *">
          <input
            required
            value={liAt}
            onChange={(e) => setLiAt(e.target.value)}
            placeholder="AQEDAR…"
            autoComplete="off"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs"
          />
        </L>
        <L label="JSESSIONID *">
          <input
            required
            value={jsession}
            onChange={(e) => setJsession(e.target.value)}
            placeholder='ajax:12345…'
            autoComplete="off"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs"
          />
        </L>
        <L label="Limit zaproszeń / dzień">
          <input
            type="number"
            min={0}
            value={invites}
            onChange={(e) => setInvites(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </L>
        <L label="Limit wiadomości / dzień">
          <input
            type="number"
            min={0}
            value={messages}
            onChange={(e) => setMessages(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </L>
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

function L({
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
