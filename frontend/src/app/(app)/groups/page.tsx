"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Megaphone,
  Plus,
  Send,
  Trash2,
  Users,
} from "lucide-react";

import { api, ApiError, Campaign, CampaignGroup } from "@/lib/api-client";

const STATUS_STYLES: Record<Campaign["status"], string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-emerald-100 text-emerald-800",
  paused: "bg-amber-100 text-amber-800",
  archived: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<Campaign["status"], string> = {
  draft: "Szkic",
  active: "Aktywna",
  paused: "Wstrzymana",
  archived: "Zarchiwizowana",
};

export default function GroupsPage() {
  const [groups, setGroups] = useState<CampaignGroup[]>([]);
  const [sequences, setSequences] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [g, s] = await Promise.all([
        api.groups.list(),
        api.campaigns.list(),
      ]);
      setGroups(g);
      setSequences(s);
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
    setCreating(true);
    setError(null);
    try {
      await api.groups.create(name);
      setName("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd tworzenia");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number, n: string) {
    if (
      !window.confirm(
        `Usunąć kampanię „${n}"? Sekwencje zostaną (tylko odpięte od kampanii).`,
      )
    )
      return;
    try {
      await api.groups.delete(id);
      await refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Błąd");
    }
  }

  const byGroup = useMemo(() => {
    const m = new Map<number, Campaign[]>();
    for (const s of sequences) {
      if (s.group_id != null) {
        const arr = m.get(s.group_id) ?? [];
        arr.push(s);
        m.set(s.group_id, arr);
      }
    }
    return m;
  }, [sequences]);

  const ungrouped = sequences.filter((s) => s.group_id == null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Kampanie</h2>
        <p className="mt-1 text-sm text-gray-600">
          Parasol, który grupuje sekwencje (np. „Q3 Outbound" → kilka sekwencji).
          Sekwencje przypiszesz w ich Ustawieniach.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        <input
          type="text"
          required
          maxLength={255}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nazwa kampanii (np. Q3 Outbound)"
          className="min-w-[220px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
        <button
          type="submit"
          disabled={creating}
          className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {creating ? "Tworzę..." : "Nowa kampania"}
        </button>
      </form>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Ładowanie...</p>
      ) : (
        <div className="space-y-3">
          {groups.length === 0 && ungrouped.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
              <Megaphone className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-2 text-sm font-medium text-gray-700">
                Brak kampanii
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Utwórz pierwszą powyżej, a potem przypnij do niej sekwencje.
              </p>
            </div>
          )}

          {groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              sequences={byGroup.get(g.id) ?? []}
              onDelete={() => handleDelete(g.id, g.name)}
            />
          ))}

          {ungrouped.length > 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
              <p className="text-sm font-semibold text-gray-700">
                Sekwencje bez kampanii ({ungrouped.length})
              </p>
              <ul className="mt-2 space-y-1">
                {ungrouped.map((s) => (
                  <SequenceRow key={s.id} s={s} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GroupCard({
  group,
  sequences,
  onDelete,
}: {
  group: CampaignGroup;
  sequences: Campaign[];
  onDelete: () => void;
}) {
  const activeCount = sequences.filter((s) => s.status === "active").length;
  return (
    <div className="group rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
            <Megaphone className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{group.name}</h3>
            <p className="text-xs text-gray-500">
              {sequences.length}{" "}
              {sequences.length === 1 ? "sekwencja" : "sekwencji"}
              {activeCount > 0 && (
                <span className="text-emerald-600">
                  {" "}
                  · {activeCount} aktywnych
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={onDelete}
          title="Usuń kampanię"
          className="rounded-md p-1.5 text-gray-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {sequences.length === 0 ? (
        <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2.5 text-xs text-gray-400">
          Brak sekwencji. Przypnij sekwencję do tej kampanii w jej Ustawieniach.
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          {sequences.map((s) => (
            <SequenceRow key={s.id} s={s} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SequenceRow({ s }: { s: Campaign }) {
  return (
    <li>
      <Link
        href={`/campaigns/${s.id}`}
        className="group/row flex items-center justify-between rounded-lg px-2.5 py-2 hover:bg-gray-50"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Send className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          <span className="truncate text-sm font-medium text-gray-900">
            {s.name}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs text-gray-500">
          <span className="hidden items-center gap-1 sm:flex">
            {s.steps_count} kroków
          </span>
          <span className="hidden items-center gap-1 sm:flex">
            <Users className="h-3.5 w-3.5 text-gray-400" />
            {s.enrollments_count}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 ${STATUS_STYLES[s.status]}`}
          >
            {STATUS_LABELS[s.status] ?? s.status}
          </span>
          <ChevronRight className="h-4 w-4 text-gray-300 transition group-hover/row:text-gray-500" />
        </div>
      </Link>
    </li>
  );
}
