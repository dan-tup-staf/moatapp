"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  api,
  ApiError,
  Campaign,
  EmailAccount,
  SequenceTemplateInfo,
} from "@/lib/api-client";

const STATUS_LABELS: Record<Campaign["status"], string> = {
  draft: "Draft",
  active: "Aktywna",
  paused: "Pauza",
  archived: "Archiwum",
};

const STATUS_STYLES: Record<Campaign["status"], string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-emerald-100 text-emerald-800",
  paused: "bg-amber-100 text-amber-800",
  archived: "bg-gray-100 text-gray-500",
};

type SortKey =
  | "name"
  | "status"
  | "steps"
  | "enrollments"
  | "created";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [name, setName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortAsc, setSortAsc] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      setCampaigns(await api.campaigns.list());
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd ładowania");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    api.emailAccounts
      .list()
      .then((a) => setAccounts(a.filter((x) => x.active)))
      .catch(() => setAccounts([]));
  }, []);

  // Default the From to the first connected mailbox so sends actually use it.
  useEffect(() => {
    if (showForm && !fromEmail && accounts.length > 0) {
      setFromEmail(accounts[0].email);
      if (accounts[0].from_name) setFromName(accounts[0].from_name);
    }
  }, [showForm, accounts, fromEmail]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setCreating(true);
    try {
      await api.campaigns.create({
        name,
        from_email: fromEmail,
        from_name: fromName || undefined,
      });
      setName("");
      setFromEmail("");
      setFromName("");
      setShowForm(false);
      await refresh();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.detail : "Błąd tworzenia");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (
      !window.confirm(
        `Usunąć sekwencję "${name}" razem z krokami i odbiorcami?`,
      )
    )
      return;
    try {
      await api.campaigns.delete(id);
      await refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Błąd usuwania");
    }
  }

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortAsc(!sortAsc);
    else {
      setSortKey(k);
      setSortAsc(k === "name");
    }
  }

  const sorted = useMemo(() => {
    const arr = [...campaigns];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name, "pl");
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      else if (sortKey === "steps") cmp = a.steps_count - b.steps_count;
      else if (sortKey === "enrollments")
        cmp = a.enrollments_count - b.enrollments_count;
      else
        cmp =
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime();
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [campaigns, sortKey, sortAsc]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sekwencje</h2>
          <p className="mt-1 text-sm text-gray-600">
            {campaigns.length}{" "}
            {campaigns.length === 1 ? "sekwencja" : "sekwencji"} — ciągi kroków
            outreachu (kroki, odbiorcy, ustawienia, wysyłka)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowTemplates((v) => !v);
              setShowForm(false);
            }}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {showTemplates ? "Ukryj szablony" : "Z szablonu"}
          </button>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setShowTemplates(false);
            }}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            {showForm ? "Anuluj" : "+ Nowa sekwencja"}
          </button>
        </div>
      </div>

      {showTemplates && (
        <TemplatesPanel
          accounts={accounts}
          onCreated={(id) => router.push(`/campaigns/${id}`)}
        />
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
        >
          <h3 className="text-sm font-medium text-gray-700">Nowa sekwencja</h3>
          <input
            type="text"
            required
            maxLength={255}
            placeholder="Nazwa sekwencji *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {accounts.length > 0 ? (
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                  Skrzynka wysyłkowa *
                </label>
                <select
                  required
                  value={fromEmail}
                  onChange={(e) => {
                    setFromEmail(e.target.value);
                    const a = accounts.find((x) => x.email === e.target.value);
                    if (a?.from_name) setFromName(a.from_name);
                  }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.email}>
                      {a.email}
                      {a.verified ? " ✓" : a.has_password ? " (nietestowana)" : " (brak hasła)"}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                  From email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="from email *"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                From name
              </label>
              <input
                type="text"
                placeholder="from name (opcjonalnie)"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </div>
          </div>
          {accounts.length === 0 ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Nie masz podłączonej skrzynki — kampania nie wyśle się realnie.{" "}
              <Link href="/deliverability" className="font-medium underline">
                Podłącz skrzynkę
              </Link>{" "}
              w Dostarczalności, aby maile wychodziły z Twojego adresu.
            </p>
          ) : (
            <p className="text-xs text-gray-500">
              Maile wyjdą z wybranej, podłączonej skrzynki.{" "}
              <Link href="/deliverability" className="underline">
                Zarządzaj skrzynkami
              </Link>
            </p>
          )}
          {formError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </p>
          )}
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {creating ? "Tworzenie..." : "Utwórz"}
          </button>
        </form>
      )}

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Ładowanie...</p>
        ) : campaigns.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">
            Brak sekwencji. Kliknij „+ Nowa sekwencja" powyżej.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th k="name" sortKey={sortKey} asc={sortAsc} onClick={toggleSort}>
                  Nazwa
                </Th>
                <Th k="status" sortKey={sortKey} asc={sortAsc} onClick={toggleSort}>
                  Status
                </Th>
                <Th
                  k="steps"
                  sortKey={sortKey}
                  asc={sortAsc}
                  onClick={toggleSort}
                  align="right"
                >
                  Stepów
                </Th>
                <Th
                  k="enrollments"
                  sortKey={sortKey}
                  asc={sortAsc}
                  onClick={toggleSort}
                  align="right"
                >
                  Enrollmentów
                </Th>
                <Th
                  k="created"
                  sortKey={sortKey}
                  asc={sortAsc}
                  onClick={toggleSort}
                >
                  Utworzona
                </Th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sorted.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="font-medium text-gray-900 hover:underline"
                    >
                      {c.name}
                    </Link>
                    <div className="text-xs text-gray-500">
                      {c.from_name
                        ? `${c.from_name} <${c.from_email}>`
                        : c.from_email}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLES[c.status]}`}
                    >
                      {STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {c.steps_count}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {c.enrollments_count}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {new Date(c.created_at).toLocaleDateString("pl-PL")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(c.id, c.name)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Usuń
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Th({
  children,
  k,
  sortKey,
  asc,
  onClick,
  align = "left",
}: {
  children: React.ReactNode;
  k: SortKey;
  sortKey: SortKey;
  asc: boolean;
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = k === sortKey;
  return (
    <th
      onClick={() => onClick(k)}
      className={
        "cursor-pointer select-none px-4 py-2 font-medium text-gray-700 hover:bg-gray-100 " +
        (align === "right" ? "text-right" : "text-left")
      }
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <span className={"text-xs " + (active ? "text-gray-700" : "text-gray-300")}>
          {active ? (asc ? "↑" : "↓") : "↕"}
        </span>
      </span>
    </th>
  );
}

function TemplatesPanel({
  accounts,
  onCreated,
}: {
  accounts: EmailAccount[];
  onCreated: (id: number) => void;
}) {
  const [templates, setTemplates] = useState<SequenceTemplateInfo[]>([]);
  const [pick, setPick] = useState<SequenceTemplateInfo | null>(null);
  const [name, setName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.campaigns.templates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  useEffect(() => {
    if (pick) {
      setName(pick.name);
      if (!fromEmail && accounts[0]) setFromEmail(accounts[0].email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick]);

  async function create() {
    if (!pick) return;
    setCreating(true);
    setError(null);
    try {
      const c = await api.campaigns.fromTemplate({
        template_id: pick.id,
        from_email: fromEmail,
        name: name.trim() || undefined,
      });
      onCreated(c.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : "Błąd tworzenia");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">
        Szablony sekwencji
      </h3>
      <p className="mt-0.5 text-xs text-gray-500">
        Gotowe sekwencje z treściami i merge-tagami — wybierz, ustaw skrzynkę i
        utwórz. Treści edytujesz potem w krokach.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => setPick(t)}
            className={
              "rounded-lg border p-3 text-left transition " +
              (pick?.id === t.id
                ? "border-gray-900 ring-1 ring-gray-900"
                : "border-gray-200 hover:border-gray-300")
            }
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">{t.name}</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                {t.category}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">{t.description}</p>
            <p className="mt-1.5 text-[11px] text-gray-400">
              {t.steps_count} kroków · {t.channels.join(", ")}
            </p>
          </button>
        ))}
      </div>

      {pick && (
        <div className="mt-4 space-y-3 rounded-lg border border-gray-200 p-3">
          <p className="text-xs font-medium text-gray-700">
            Tworzysz: <span className="text-gray-900">{pick.name}</span>
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nazwa sekwencji"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {accounts.length > 0 ? (
              <select
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">— skrzynka wysyłkowa —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.email}>
                    {a.email}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="from email"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={create}
            disabled={creating || !fromEmail}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {creating ? "Tworzę…" : "Utwórz z szablonu"}
          </button>
        </div>
      )}
    </div>
  );
}
