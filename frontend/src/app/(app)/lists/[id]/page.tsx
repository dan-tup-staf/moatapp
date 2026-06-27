"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Pencil, Trash2, Upload, UserPlus, Users } from "lucide-react";

import { api, ApiError, Lead, LeadList } from "@/lib/api-client";

const AVATARS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-sky-500",
];

const LEAD_STATUS_STYLES: Record<string, string> = {
  new: "bg-gray-100 text-gray-700",
  contacted: "bg-blue-100 text-blue-800",
  replied: "bg-emerald-100 text-emerald-800",
  bounced: "bg-red-100 text-red-800",
  unsubscribed: "bg-yellow-100 text-yellow-800",
};

export default function ListDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const listId = Number(params.id);

  const [list, setList] = useState<LeadList | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  // Add lead form
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // CSV import
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  // Inline edit header
  const [editingField, setEditingField] = useState<"name" | "desc" | null>(null);
  const [draftValue, setDraftValue] = useState("");

  async function refresh() {
    try {
      const [l, lds] = await Promise.all([
        api.lists.get(listId),
        api.leads.list(listId),
      ]);
      setList(l);
      setLeads(lds);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        router.replace("/lists");
        return;
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAdding(true);
    try {
      await api.leads.create(listId, {
        email,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        company: company || undefined,
        title: title || undefined,
      });
      setEmail("");
      setFirstName("");
      setLastName("");
      setCompany("");
      setTitle("");
      await refresh();
    } catch (err) {
      setAddError(err instanceof ApiError ? err.detail : "Błąd dodawania");
    } finally {
      setAdding(false);
    }
  }

  async function handleImport(e: FormEvent) {
    e.preventDefault();
    if (!csvFile) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const result = await api.leads.importCsv(listId, csvFile);
      let msg = `Zaimportowano: ${result.imported}, pominięto: ${result.skipped}`;
      if (result.errors.length) {
        msg += `. Błędy: ${result.errors.slice(0, 3).join("; ")}`;
        if (result.errors.length > 3) msg += ` (+${result.errors.length - 3} więcej)`;
      }
      setImportMsg(msg);
      setCsvFile(null);
      // Reset the input
      const input = document.getElementById("csv-input") as HTMLInputElement | null;
      if (input) input.value = "";
      await refresh();
    } catch (err) {
      setImportMsg(
        err instanceof ApiError ? `Błąd: ${err.detail}` : "Błąd importu",
      );
    } finally {
      setImporting(false);
    }
  }

  async function handleDeleteLead(id: number) {
    if (!window.confirm("Usunąć tego leada?")) return;
    try {
      await api.leads.delete(listId, id);
      await refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Błąd usuwania");
    }
  }

  async function saveField(field: "name" | "desc", value: string) {
    if (!list) return;
    const trimmed = value.trim();
    // Noop if unchanged or name emptied
    if (field === "name") {
      if (!trimmed || trimmed === list.name) {
        setEditingField(null);
        return;
      }
      try {
        await api.lists.update(list.id, { name: trimmed });
        await refresh();
      } catch (err) {
        alert(err instanceof ApiError ? err.detail : "Błąd zapisu");
      }
    } else {
      // description — pusty string = wyczyść
      const next = trimmed || undefined;
      if (next === (list.description ?? undefined)) {
        setEditingField(null);
        return;
      }
      try {
        await api.lists.update(list.id, { description: trimmed });
        await refresh();
      } catch (err) {
        alert(err instanceof ApiError ? err.detail : "Błąd zapisu");
      }
    }
    setEditingField(null);
  }

  function startEdit(field: "name" | "desc") {
    if (!list) return;
    setEditingField(field);
    setDraftValue(field === "name" ? list.name : list.description ?? "");
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Ładowanie...</p>;
  }
  if (!list) return null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/lists"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Wszystkie listy
        </Link>
        {editingField === "name" ? (
          <input
            autoFocus
            type="text"
            value={draftValue}
            maxLength={255}
            onChange={(e) => setDraftValue(e.target.value)}
            onBlur={() => saveField("name", draftValue)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                setEditingField(null);
              }
            }}
            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-2xl font-bold tracking-tight focus:border-gray-900 focus:outline-none"
          />
        ) : (
          <h2
            onClick={() => startEdit("name")}
            className="group mt-1 inline-flex cursor-text items-center gap-2 rounded-md text-2xl font-bold tracking-tight hover:bg-gray-100 px-1 -mx-1"
            title="Kliknij aby zmienić nazwę"
          >
            {list.name}
            <Pencil className="h-3.5 w-3.5 text-gray-400 opacity-0 group-hover:opacity-100" />
          </h2>
        )}
        {editingField === "desc" ? (
          <input
            autoFocus
            type="text"
            value={draftValue}
            placeholder="Opis listy (pusty = usuń)"
            onChange={(e) => setDraftValue(e.target.value)}
            onBlur={() => saveField("desc", draftValue)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                setEditingField(null);
              }
            }}
            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        ) : list.description ? (
          <p
            onClick={() => startEdit("desc")}
            className="group mt-1 inline-flex cursor-text items-center gap-2 rounded-md px-1 -mx-1 text-sm text-gray-600 hover:bg-gray-100"
            title="Kliknij aby zmienić opis"
          >
            {list.description}
            <Pencil className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100" />
          </p>
        ) : (
          <button
            onClick={() => startEdit("desc")}
            className="mt-1 text-xs text-gray-400 hover:text-gray-700"
          >
            + dodaj opis
          </button>
        )}
        <p className="mt-1 text-sm text-gray-400">
          {leads.length} {leads.length === 1 ? "lead" : "leadów"}
        </p>
      </div>

      {/* Add lead form */}
      <form
        onSubmit={handleAdd}
        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <UserPlus className="h-4 w-4 text-gray-400" />
          Dodaj lead ręcznie
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            type="email"
            required
            placeholder="email *"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
          <input
            type="text"
            placeholder="firma"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
          <input
            type="text"
            placeholder="imię"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
          <input
            type="text"
            placeholder="nazwisko"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
          <input
            type="text"
            placeholder="stanowisko"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 md:col-span-2"
          />
        </div>
        {addError && (
          <p className="mt-2 text-sm text-red-600">{addError}</p>
        )}
        <button
          disabled={adding}
          className="mt-3 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {adding ? "Dodawanie..." : "Dodaj lead"}
        </button>
      </form>

      {/* CSV import */}
      <form
        onSubmit={handleImport}
        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <Upload className="h-4 w-4 text-gray-400" />
          Import CSV
        </h3>
        <p className="mb-3 text-xs text-gray-500">
          Wymagana kolumna: <code className="rounded bg-gray-100 px-1">email</code>.
          Opcjonalne: <code className="rounded bg-gray-100 px-1">first_name</code>,{" "}
          <code className="rounded bg-gray-100 px-1">last_name</code>,{" "}
          <code className="rounded bg-gray-100 px-1">company</code>,{" "}
          <code className="rounded bg-gray-100 px-1">title</code>,{" "}
          <code className="rounded bg-gray-100 px-1">linkedin_url</code>,{" "}
          <code className="rounded bg-gray-100 px-1">website</code>,{" "}
          <code className="rounded bg-gray-100 px-1">notes</code>
        </p>
        <input
          id="csv-input"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border file:border-gray-300 file:bg-gray-50 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-gray-100"
        />
        {importMsg && (
          <p className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
            {importMsg}
          </p>
        )}
        <button
          disabled={!csvFile || importing}
          className="mt-3 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {importing ? "Importowanie..." : "Importuj"}
        </button>
      </form>

      {/* Leads table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {leads.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">
              Brak leadów. Dodaj ręcznie albo zaimportuj CSV.
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                  Osoba
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                  Firma / stanowisko
                </th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                  Status
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-gray-600">
                  Score
                </th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.map((l, i) => {
                const name =
                  [l.first_name, l.last_name].filter(Boolean).join(" ") ||
                  l.email;
                const ini =
                  (
                    (l.first_name?.[0] ?? "") + (l.last_name?.[0] ?? "")
                  ).toUpperCase() ||
                  l.email[0]?.toUpperCase() ||
                  "?";
                return (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
                            AVATARS[i % AVATARS.length]
                          }`}
                        >
                          {ini}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-gray-900">
                            {name}
                          </div>
                          <div className="truncate text-xs text-gray-500">
                            {l.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="text-gray-900">{l.company || "—"}</div>
                      {l.title && (
                        <div className="text-xs text-gray-500">{l.title}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          LEAD_STATUS_STYLES[l.status] ??
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-900">
                      {l.score}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleDeleteLead(l.id)}
                        title="Usuń leada"
                        className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
