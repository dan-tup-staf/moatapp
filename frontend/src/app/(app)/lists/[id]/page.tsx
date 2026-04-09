"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { api, ApiError, Lead, LeadList } from "@/lib/api-client";

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

  if (loading) {
    return <p className="text-sm text-gray-500">Ładowanie...</p>;
  }
  if (!list) return null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/lists" className="text-sm text-gray-500 hover:underline">
          ← Wszystkie listy
        </Link>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">{list.name}</h2>
        {list.description && (
          <p className="mt-1 text-sm text-gray-600">{list.description}</p>
        )}
        <p className="mt-1 text-sm text-gray-400">
          {leads.length} {leads.length === 1 ? "lead" : "leadów"}
        </p>
      </div>

      {/* Add lead form */}
      <form
        onSubmit={handleAdd}
        className="rounded-lg border border-gray-200 bg-white p-4"
      >
        <h3 className="mb-3 text-sm font-medium text-gray-700">
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
        className="rounded-lg border border-gray-200 bg-white p-4"
      >
        <h3 className="mb-1 text-sm font-medium text-gray-700">Import CSV</h3>
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
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        {leads.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">
            Brak leadów. Dodaj ręcznie albo zaimportuj CSV.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Email
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Imię i nazwisko
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Firma
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Stanowisko
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">
                  Status
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">
                  Score
                </th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {leads.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{l.email}</td>
                  <td className="px-4 py-2 text-gray-700">
                    {[l.first_name, l.last_name].filter(Boolean).join(" ") ||
                      "—"}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {l.company || "—"}
                  </td>
                  <td className="px-4 py-2 text-gray-700">{l.title || "—"}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-gray-900">
                    {l.score}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleDeleteLead(l.id)}
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
