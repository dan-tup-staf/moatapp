"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import {
  api,
  ApiError,
  CompanyRow,
  LeadList,
  PersonRow,
} from "@/lib/api-client";

type Tab = "lists" | "companies" | "people";

const TAB_LABELS: Record<Tab, string> = {
  lists: "Listy",
  companies: "Firmy",
  people: "Osoby",
};

export default function ContactsPage() {
  const [tab, setTab] = useState<Tab>("lists");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Kontakty</h2>
        <p className="mt-1 text-sm text-gray-600">
          {tab === "lists" && "Kolekcje prospektów do outreachu"}
          {tab === "companies" && "Firmy zagregowane z wszystkich Twoich list"}
          {tab === "people" && "Wszystkie osoby z wszystkich list"}
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex border-b border-gray-200">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                "px-4 py-3 text-sm font-medium border-b-2 -mb-px transition " +
                (tab === t
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-900")
              }
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {tab === "lists" && <ListsTab />}
      {tab === "companies" && <CompaniesTab />}
      {tab === "people" && <PeopleTab />}
    </div>
  );
}

// ---------- Listy tab (existing behavior) ----------

function ListsTab() {
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

// ---------- Firmy tab ----------

type SortCompanies = "score" | "leads" | "signals" | "recent";

function CompaniesTab() {
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
          Brak firm — dodaj leadów z polem „firma" w zakładce Listy, a pojawią
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

// ---------- Osoby tab ----------

type SortPeople = "score" | "recent" | "name" | "signals";

function PeopleTab() {
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
            ? "Brak osób — dodaj leadów do listy w zakładce Listy."
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
