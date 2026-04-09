"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { api, ApiError, LeadList } from "@/lib/api-client";

export default function ListsPage() {
  const [lists, setLists] = useState<LeadList[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const data = await api.lists.list();
      setLists(data);
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
        `Usunąć listę "${name}" razem ze wszystkimi jej leadami? Tej operacji nie da się cofnąć.`,
      )
    ) {
      return;
    }
    try {
      await api.lists.delete(id);
      await refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Błąd usuwania");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Listy leadów</h2>
        <p className="mt-1 text-sm text-gray-600">
          Twoje kolekcje prospektów do outreachu
        </p>
      </div>

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
                    {l.leads_count}{" "}
                    {l.leads_count === 1 ? "lead" : "leadów"} • utworzona{" "}
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
