"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { api, ApiError, Campaign } from "@/lib/api-client";

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

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
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
  }, []);

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
        `Usunąć kampanię "${name}" razem ze stepami i enrollmentami?`,
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
          <h2 className="text-2xl font-bold tracking-tight">Kampanie</h2>
          <p className="mt-1 text-sm text-gray-600">
            {campaigns.length}{" "}
            {campaigns.length === 1 ? "kampania" : "kampanii"}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          {showForm ? "Anuluj" : "+ Nowa kampania"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
        >
          <h3 className="text-sm font-medium text-gray-700">Nowa kampania</h3>
          <input
            type="text"
            required
            maxLength={255}
            placeholder="Nazwa kampanii *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              type="email"
              required
              placeholder="from email *"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
            <input
              type="text"
              placeholder="from name (opcjonalnie)"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
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
            Brak kampanii. Kliknij „+ Nowa kampania" powyżej.
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
