"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  Trash2,
} from "lucide-react";

import { api, ApiError, Signal, SignalSummary } from "@/lib/api-client";

type SortMode = "newest" | "oldest" | "company";
type Filter = "all" | "linked" | "orphan";
type GroupMode = "none" | "by_company";

function getCompanyName(s: Signal): string {
  const name = s.payload?.company_name;
  if (typeof name === "string" && name.trim()) return name;
  return s.company_domain || "(bez firmy)";
}

export default function SignalDetailPage() {
  const params = useParams<{ source_id: string }>();
  const sourceId = Number(params.source_id);

  const [summary, setSummary] = useState<SignalSummary | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sort, setSort] = useState<SortMode>("newest");
  const [filter, setFilter] = useState<Filter>("all");
  const [group, setGroup] = useState<GroupMode>("by_company");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [summaries, list] = await Promise.all([
        api.signals.summary(),
        api.signals.list({ sourceId, limit: 500 }),
      ]);
      setSummary(summaries.find((s) => s.source_id === sourceId) ?? null);
      setSignals(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd ładowania");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  async function handleDelete(id: number) {
    if (!window.confirm("Usunąć ten sygnał?")) return;
    try {
      await api.signals.delete(id);
      await refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Błąd");
    }
  }

  const processed = useMemo(() => {
    let arr = [...signals];
    if (filter === "linked") arr = arr.filter((s) => s.lead_id !== null);
    if (filter === "orphan") arr = arr.filter((s) => s.lead_id === null);

    arr.sort((a, b) => {
      if (sort === "newest")
        return (
          new Date(b.detected_at).getTime() -
          new Date(a.detected_at).getTime()
        );
      if (sort === "oldest")
        return (
          new Date(a.detected_at).getTime() -
          new Date(b.detected_at).getTime()
        );
      // company
      return getCompanyName(a).localeCompare(getCompanyName(b), "pl");
    });
    return arr;
  }, [signals, filter, sort]);

  const grouped = useMemo(() => {
    if (group === "none") return null;
    const map = new Map<string, Signal[]>();
    for (const s of processed) {
      const key = getCompanyName(s);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => {
      if (sort === "company") return a[0].localeCompare(b[0], "pl");
      // keep most recent first
      const aLatest = Math.max(
        ...a[1].map((s) => new Date(s.detected_at).getTime()),
      );
      const bLatest = Math.max(
        ...b[1].map((s) => new Date(s.detected_at).getTime()),
      );
      return sort === "oldest" ? aLatest - bLatest : bLatest - aLatest;
    });
  }, [processed, group, sort]);

  if (loading) {
    return <p className="text-sm text-gray-500">Ładowanie...</p>;
  }
  if (error) {
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/signals"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Wszystkie sygnały
        </Link>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">
          {summary?.source_name ?? `Source #${sourceId}`}
        </h2>
        {summary && (
          <p className="mt-1 text-sm text-gray-600">
            {summary.signals_count} detekcji · {summary.unique_companies}{" "}
            firm · {summary.linked_leads_count}{" "}
            {summary.linked_leads_count === 1 ? "lead" : "leadów"} powiązanych
            · +{summary.pipeline_impact} pipeline
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <FilterGroup
          label="Filtr"
          options={[
            { value: "all", label: "Wszystkie" },
            { value: "linked", label: "Powiązane" },
            { value: "orphan", label: "Bez powiązania" },
          ]}
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
        />
        <FilterGroup
          label="Sort"
          options={[
            { value: "newest", label: "Najnowsze" },
            { value: "oldest", label: "Najstarsze" },
            { value: "company", label: "Firma" },
          ]}
          value={sort}
          onChange={(v) => setSort(v as SortMode)}
        />
        <FilterGroup
          label="Grupowanie"
          options={[
            { value: "by_company", label: "Po firmie" },
            { value: "none", label: "Płasko" },
          ]}
          value={group}
          onChange={(v) => setGroup(v as GroupMode)}
        />
        <div className="ml-auto text-xs text-gray-500">
          Pokazuję {processed.length} z {signals.length}
        </div>
      </div>

      {/* Content */}
      {processed.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
          Brak sygnałów pasujących do filtra.
        </p>
      ) : grouped ? (
        <div className="space-y-3">
          {grouped.map(([company, items]) => (
            <CompanyGroup
              key={company}
              company={company}
              items={items}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white">
          <ul className="divide-y divide-gray-200">
            {processed.map((s) => (
              <li key={s.id} className="p-4 hover:bg-gray-50">
                <SignalRow signal={s} onDelete={handleDelete} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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

function CompanyGroup({
  company,
  items,
  onDelete,
}: {
  company: string;
  items: Signal[];
  onDelete: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const linked = items.filter((s) => s.lead_id !== null);
  const totalImpact = linked.reduce((a, s) => a + s.score_weight, 0);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-gray-50"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{company}</span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                {items.length} {items.length === 1 ? "oferta" : "ofert"}
              </span>
              {linked.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-800">
                  <Check className="h-3 w-3" />
                  zlinkowane +{totalImpact}
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-sm text-gray-500">
              {items[0].title}
              {items.length > 1
                ? ` + ${items.length - 1} ${items.length - 1 === 1 ? "inna" : "innych"}`
                : ""}
            </p>
          </div>
        </div>
        <ChevronRight
          className={
            "h-4 w-4 shrink-0 text-gray-400 transition-transform " +
            (open ? "rotate-90" : "")
          }
        />
      </button>
      {open && (
        <ul className="divide-y divide-gray-100 border-t border-gray-100">
          {items.map((s) => (
            <li key={s.id} className="p-4">
              <SignalRow signal={s} onDelete={onDelete} compact />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SignalRow({
  signal: s,
  onDelete,
  compact = false,
}: {
  signal: Signal;
  onDelete: (id: number) => void;
  compact?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(s.detected_at).toLocaleString("pl-PL")}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5">
            +{s.score_weight}
          </span>
        </div>

        {s.url ? (
          <a
            href={s.url}
            target="_blank"
            rel="noreferrer noopener"
            className={
              "mt-1 block font-medium text-gray-900 hover:underline " +
              (compact ? "text-sm" : "")
            }
          >
            {s.title}
          </a>
        ) : (
          <p
            className={
              "mt-1 font-medium text-gray-900 " + (compact ? "text-sm" : "")
            }
          >
            {s.title}
          </p>
        )}

        {(typeof s.payload.workplace === "string" ||
          Array.isArray(s.payload.work_modes) ||
          Array.isArray(s.payload.contract_types)) && (
          <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-gray-500">
            {typeof s.payload.workplace === "string" &&
              s.payload.workplace && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5">
                  <MapPin className="h-3 w-3" />
                  {s.payload.workplace as string}
                </span>
              )}
            {Array.isArray(s.payload.work_modes) &&
              (s.payload.work_modes as string[]).length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5">
                  <Building2 className="h-3 w-3" />
                  {(s.payload.work_modes as string[]).join(", ")}
                </span>
              )}
            {Array.isArray(s.payload.contract_types) &&
              (s.payload.contract_types as string[]).length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5">
                  <FileText className="h-3 w-3" />
                  {(s.payload.contract_types as string[]).join(", ")}
                </span>
              )}
          </div>
        )}

        {!compact &&
          typeof s.payload.ai_summary === "string" &&
          s.payload.ai_summary && (
            <div
              className="mt-1 line-clamp-3 text-xs text-gray-600 [&_b]:font-semibold [&_li]:ml-4 [&_li]:list-disc"
              dangerouslySetInnerHTML={{
                __html: s.payload.ai_summary as string,
              }}
            />
          )}

        {s.lead_email ? (
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-700">
            <Check className="h-3 w-3" />
            powiązane z <span className="font-medium">{s.lead_email}</span>
          </p>
        ) : (
          <p className="mt-2 text-xs text-gray-400">bez powiązania z leadem</p>
        )}
      </div>

      <button
        onClick={() => onDelete(s.id)}
        title="Usuń sygnał"
        className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
