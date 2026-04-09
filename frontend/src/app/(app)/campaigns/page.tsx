"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { api, ApiError, Campaign } from "@/lib/api-client";

const STATUS_LABELS: Record<Campaign["status"], string> = {
  draft: "Draft",
  active: "Aktywna",
  paused: "Pauza",
  archived: "Archiwum",
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
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
        `Usunąć kampanię "${name}" razem ze stepami i enrollmentami?`,
      )
    ) {
      return;
    }
    try {
      await api.campaigns.delete(id);
      await refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Błąd usuwania");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Kampanie</h2>
        <p className="mt-1 text-sm text-gray-600">
          Sekwencje cold outreach z wieloma stepami
        </p>
      </div>

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
          {creating ? "Tworzenie..." : "Utwórz kampanię"}
        </button>
      </form>

      <div className="rounded-lg border border-gray-200 bg-white">
        {loading ? (
          <p className="p-4 text-sm text-gray-500">Ładowanie...</p>
        ) : campaigns.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">
            Brak kampanii. Utwórz pierwszą powyżej.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {campaigns.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="font-medium text-gray-900 hover:underline"
                    >
                      {c.name}
                    </Link>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                      {STATUS_LABELS[c.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {c.from_name ? `${c.from_name} <${c.from_email}>` : c.from_email}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    {c.steps_count} {c.steps_count === 1 ? "step" : "stepów"} •{" "}
                    {c.enrollments_count}{" "}
                    {c.enrollments_count === 1 ? "lead" : "leadów"} • utworzona{" "}
                    {new Date(c.created_at).toLocaleDateString("pl-PL")}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(c.id, c.name)}
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
