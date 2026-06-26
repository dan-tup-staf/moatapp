"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Download,
  Eye,
  Mail,
  MousePointerClick,
  Pause,
  Play,
  Plus,
  Search,
  Tag as TagIcon,
  Trash2,
  X,
} from "lucide-react";

import {
  api,
  ApiError,
  BulkAction,
  Enrollment,
  EnrollmentOutcome,
  EnrollmentStatus,
  ProspectFunnel,
} from "@/lib/api-client";

// ---------- static maps ----------

type FunnelKey =
  | "total"
  | "not_contacted"
  | "contacted"
  | "opened"
  | "clicked"
  | "replied"
  | "interested"
  | "meeting_booked"
  | "closed"
  | "out_of_office";

const FUNNEL_STEPS: { key: FunnelKey; label: string; color: string }[] = [
  { key: "total", label: "Wszyscy", color: "text-gray-900" },
  { key: "not_contacted", label: "Bez kontaktu", color: "text-gray-500" },
  { key: "contacted", label: "Skontaktowani", color: "text-blue-600" },
  { key: "opened", label: "Otwarcia", color: "text-indigo-600" },
  { key: "clicked", label: "Kliknięcia", color: "text-violet-600" },
  { key: "replied", label: "Odpowiedzi", color: "text-emerald-600" },
  { key: "interested", label: "Zainteresowani", color: "text-emerald-700" },
  { key: "meeting_booked", label: "Spotkania", color: "text-indigo-700" },
  { key: "closed", label: "Zamknięci", color: "text-green-700" },
  { key: "out_of_office", label: "Poza biurem", color: "text-amber-600" },
];

const OUTCOMES: { value: EnrollmentOutcome; label: string; cls: string }[] = [
  { value: "interested", label: "Zainteresowany", cls: "bg-emerald-100 text-emerald-800" },
  { value: "meeting_booked", label: "Umówione spotkanie", cls: "bg-indigo-100 text-indigo-800" },
  { value: "closed_won", label: "Zamknięty (won)", cls: "bg-green-100 text-green-800" },
  { value: "not_interested", label: "Niezainteresowany", cls: "bg-gray-100 text-gray-700" },
  { value: "out_of_office", label: "Poza biurem", cls: "bg-amber-100 text-amber-800" },
];

const OUTCOME_MAP = Object.fromEntries(OUTCOMES.map((o) => [o.value, o]));

const STATUS_BADGE: Record<EnrollmentStatus, { label: string; cls: string }> = {
  active: { label: "Aktywny", cls: "bg-emerald-100 text-emerald-800" },
  paused: { label: "Pauza", cls: "bg-amber-100 text-amber-800" },
  completed: { label: "Ukończony", cls: "bg-gray-100 text-gray-600" },
  replied: { label: "Odpowiedział", cls: "bg-blue-100 text-blue-800" },
  bounced: { label: "Odbity", cls: "bg-red-100 text-red-700" },
};

// ---------- helpers ----------

function matchesFunnel(e: Enrollment, key: FunnelKey): boolean {
  switch (key) {
    case "total":
      return true;
    case "not_contacted":
      return e.sent_count === 0;
    case "contacted":
      return e.sent_count > 0;
    case "opened":
      return e.opened_count > 0;
    case "clicked":
      return e.clicked_count > 0;
    case "replied":
      return e.status === "replied";
    case "interested":
      return e.outcome === "interested";
    case "meeting_booked":
      return e.outcome === "meeting_booked";
    case "closed":
      return e.outcome === "closed_won";
    case "out_of_office":
      return e.outcome === "out_of_office";
    default:
      return true;
  }
}

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "przed chwilą";
  if (min < 60) return `${min} min temu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} godz. temu`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days} dni temu`;
  return d.toLocaleDateString("pl-PL");
}

function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ---------- component ----------

export function ProspectsTab({
  campaignId,
  enrollments,
  funnel,
  onRefresh,
  onAddLeads,
  builderOpen,
}: {
  campaignId: number;
  enrollments: Enrollment[];
  funnel: ProspectFunnel | null;
  onRefresh: () => Promise<void>;
  onAddLeads: () => void;
  builderOpen: boolean;
}) {
  const [active, setActive] = useState<FunnelKey>("total");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tagEditId, setTagEditId] = useState<number | null>(null);
  const [tagDraft, setTagDraft] = useState("");

  const funnelCounts: Record<FunnelKey, number> = useMemo(() => {
    if (funnel) {
      return {
        total: funnel.total,
        not_contacted: funnel.not_contacted,
        contacted: funnel.contacted,
        opened: funnel.opened,
        clicked: funnel.clicked,
        replied: funnel.replied,
        interested: funnel.interested,
        meeting_booked: funnel.meeting_booked,
        closed: funnel.closed,
        out_of_office: funnel.out_of_office,
      };
    }
    // Fallback: derive from rows
    const c = {} as Record<FunnelKey, number>;
    FUNNEL_STEPS.forEach(
      (s) => (c[s.key] = enrollments.filter((e) => matchesFunnel(e, s.key)).length),
    );
    return c;
  }, [funnel, enrollments]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enrollments
      .filter((e) => matchesFunnel(e, active))
      .filter((e) => {
        if (!q) return true;
        return (
          (e.lead_email ?? "").toLowerCase().includes(q) ||
          (e.lead_name ?? "").toLowerCase().includes(q) ||
          (e.lead_company ?? "").toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q))
        );
      });
  }, [enrollments, active, query]);

  const allVisibleSelected =
    rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggleAll() {
    if (allVisibleSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  }

  function toggleOne(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function runBulk(action: BulkAction, extra?: { tag?: string; outcome?: EnrollmentOutcome }) {
    if (selected.size === 0) return;
    if (action === "remove" && !window.confirm(`Usunąć ${selected.size} odbiorców z sekwencji?`))
      return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api.campaigns.bulkEnrollments(campaignId, {
        enrollment_ids: Array.from(selected),
        action,
        ...extra,
      });
      setMsg(`Zaktualizowano ${r.affected} odbiorców.`);
      setSelected(new Set());
      await onRefresh();
    } catch (err) {
      setMsg(err instanceof ApiError ? `Błąd: ${err.detail}` : "Błąd");
    } finally {
      setBusy(false);
    }
  }

  async function patchOne(id: number, patch: Parameters<typeof api.campaigns.updateEnrollment>[2]) {
    setBusy(true);
    try {
      await api.campaigns.updateEnrollment(campaignId, id, patch);
      await onRefresh();
    } catch (err) {
      setMsg(err instanceof ApiError ? `Błąd: ${err.detail}` : "Błąd");
    } finally {
      setBusy(false);
    }
  }

  async function removeOne(id: number) {
    if (!window.confirm("Usunąć tego odbiorcę z sekwencji?")) return;
    setBusy(true);
    try {
      await api.campaigns.unenroll(campaignId, id);
      await onRefresh();
    } catch (err) {
      setMsg(err instanceof ApiError ? `Błąd: ${err.detail}` : "Błąd");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const header = [
      "email",
      "name",
      "company",
      "title",
      "status",
      "outcome",
      "current_step",
      "sent",
      "opened",
      "clicked",
      "tags",
      "last_activity",
    ];
    const lines = rows.map((e) =>
      [
        e.lead_email,
        e.lead_name,
        e.lead_company,
        e.lead_title,
        e.status,
        e.outcome ?? "",
        e.current_step,
        e.sent_count,
        e.opened_count,
        e.clicked_count,
        e.tags.join("|"),
        e.last_activity_at ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `odbiorcy-kampania-${campaignId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function commitTag(id: number) {
    const t = tagDraft.trim();
    setTagEditId(null);
    setTagDraft("");
    if (!t) return;
    const e = enrollments.find((x) => x.id === id);
    if (!e || e.tags.includes(t)) return;
    await patchOne(id, { tags: [...e.tags, t] });
  }

  async function removeTag(id: number, tag: string) {
    const e = enrollments.find((x) => x.id === id);
    if (!e) return;
    await patchOne(id, { tags: e.tags.filter((t) => t !== tag) });
  }

  const hasSelection = selected.size > 0;

  return (
    <div className="space-y-4">
      {/* Status funnel bar */}
      <div className="flex flex-wrap gap-2">
        {FUNNEL_STEPS.map((s) => {
          const isActive = active === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className={
                "flex min-w-[92px] flex-col items-start rounded-lg border px-3 py-2 text-left transition " +
                (isActive
                  ? "border-gray-900 bg-gray-900/[0.03] ring-1 ring-gray-900/10"
                  : "border-gray-200 bg-white hover:border-gray-400")
              }
            >
              <span className={`text-lg font-bold leading-none ${s.color}`}>
                {funnelCounts[s.key] ?? 0}
              </span>
              <span className="mt-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                {s.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-2.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj po nazwisku, mailu, firmie, tagu…"
            className="w-full rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-sm focus:border-gray-500 focus:outline-none"
          />
        </div>

        {hasSelection ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-1 text-xs font-medium text-gray-600">
              Zaznaczono {selected.size}
            </span>
            <BulkOutcomeMenu onPick={(o) => runBulk("set_outcome", { outcome: o })} disabled={busy} />
            <BulkTagButton onAdd={(t) => runBulk("add_tag", { tag: t })} disabled={busy} />
            <ToolbarBtn icon={Pause} label="Pauza" onClick={() => runBulk("pause")} disabled={busy} />
            <ToolbarBtn icon={Play} label="Wznów" onClick={() => runBulk("resume")} disabled={busy} />
            <ToolbarBtn
              icon={Trash2}
              label="Usuń"
              danger
              onClick={() => runBulk("remove")}
              disabled={busy}
            />
          </div>
        ) : (
          <>
            <button
              onClick={onAddLeads}
              className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              <Plus className="h-4 w-4" /> {builderOpen ? "Zwiń dobieranie" : "Dobierz leady"}
            </button>
            <ToolbarBtn icon={Download} label="Eksport CSV" onClick={exportCsv} disabled={rows.length === 0} />
          </>
        )}
      </div>

      {msg && (
        <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700">{msg}</p>
      )}

      {/* Table */}
      {enrollments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-sm font-medium text-gray-700">Brak odbiorców w sekwencji</p>
          <p className="mt-1 text-xs text-gray-500">
            Kliknij „Dobierz leady”, aby wybrać firmy/osoby z list i sygnałów.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Brak odbiorców pasujących do filtra „{FUNNEL_STEPS.find((s) => s.key === active)?.label}”.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </th>
                <th className="px-3 py-2.5">Odbiorca</th>
                <th className="px-3 py-2.5">Firma</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Krok / aktywność</th>
                <th className="px-3 py-2.5">Outcome</th>
                <th className="px-3 py-2.5">Tagi</th>
                <th className="px-3 py-2.5">Ostatnia aktywność</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((e) => {
                const badge = STATUS_BADGE[e.status];
                const isSel = selected.has(e.id);
                return (
                  <tr key={e.id} className={isSel ? "bg-gray-50/70" : "hover:bg-gray-50/60"}>
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleOne(e.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-gray-900">
                        {e.lead_name || e.lead_email}
                      </div>
                      <div className="text-xs text-gray-500">{e.lead_email}</div>
                      {e.lead_title && (
                        <div className="text-[11px] text-gray-400">{e.lead_title}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700">{e.lead_company || "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700">
                          krok {e.current_step + 1}
                        </span>
                        <span className="inline-flex items-center gap-1" title="Wysłane">
                          <Mail className="h-3.5 w-3.5 text-gray-400" />
                          {e.sent_count}
                        </span>
                        <span className="inline-flex items-center gap-1" title="Otwarcia">
                          <Eye className="h-3.5 w-3.5 text-indigo-400" />
                          {e.opened_count}
                        </span>
                        <span className="inline-flex items-center gap-1" title="Kliknięcia">
                          <MousePointerClick className="h-3.5 w-3.5 text-violet-400" />
                          {e.clicked_count}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <OutcomeSelect
                        value={e.outcome}
                        onChange={(o) =>
                          o
                            ? patchOne(e.id, { outcome: o })
                            : patchOne(e.id, { clear_outcome: true })
                        }
                        disabled={busy}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-1">
                        {e.tags.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700"
                          >
                            {t}
                            <button
                              onClick={() => removeTag(e.id, t)}
                              className="text-gray-400 hover:text-red-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                        {tagEditId === e.id ? (
                          <input
                            autoFocus
                            value={tagDraft}
                            onChange={(ev) => setTagDraft(ev.target.value)}
                            onBlur={() => commitTag(e.id)}
                            onKeyDown={(ev) => {
                              if (ev.key === "Enter") commitTag(e.id);
                              if (ev.key === "Escape") {
                                setTagEditId(null);
                                setTagDraft("");
                              }
                            }}
                            placeholder="tag…"
                            className="w-20 rounded border border-gray-300 px-1.5 py-0.5 text-[11px] focus:outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => {
                              setTagEditId(e.id);
                              setTagDraft("");
                            }}
                            className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-gray-300 px-1.5 py-0.5 text-[11px] text-gray-500 hover:border-gray-500 hover:text-gray-700"
                          >
                            <TagIcon className="h-3 w-3" /> tag
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">
                      {relTime(e.last_activity_at)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {e.status === "paused" ? (
                          <IconBtn
                            title="Wznów"
                            onClick={() => patchOne(e.id, { status: "active" })}
                          >
                            <Play className="h-4 w-4" />
                          </IconBtn>
                        ) : e.status === "active" ? (
                          <IconBtn
                            title="Pauza"
                            onClick={() => patchOne(e.id, { status: "paused" })}
                          >
                            <Pause className="h-4 w-4" />
                          </IconBtn>
                        ) : null}
                        <IconBtn title="Usuń" danger onClick={() => removeOne(e.id)}>
                          <Trash2 className="h-4 w-4" />
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- sub-pieces ----------

function ToolbarBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: typeof Pause;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition disabled:opacity-50 " +
        (danger
          ? "border-red-200 text-red-600 hover:bg-red-50"
          : "border-gray-300 text-gray-700 hover:bg-gray-100")
      }
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={
        "rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 " +
        (danger ? "hover:text-red-600" : "hover:text-gray-700")
      }
    >
      {children}
    </button>
  );
}

function OutcomeSelect({
  value,
  onChange,
  disabled,
}: {
  value: EnrollmentOutcome | null;
  onChange: (o: EnrollmentOutcome | null) => void;
  disabled?: boolean;
}) {
  const current = value ? OUTCOME_MAP[value] : null;
  return (
    <div className="relative inline-block">
      <select
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) =>
          onChange(e.target.value ? (e.target.value as EnrollmentOutcome) : null)
        }
        className={
          "appearance-none rounded-full border py-0.5 pl-2.5 pr-6 text-xs font-medium focus:outline-none " +
          (current ? current.cls + " border-transparent" : "border-gray-300 bg-white text-gray-500")
        }
      >
        <option value="">— ustaw —</option>
        {OUTCOMES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-current opacity-60" />
    </div>
  );
}

function BulkOutcomeMenu({
  onPick,
  disabled,
}: {
  onPick: (o: EnrollmentOutcome) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
      >
        <Check className="h-4 w-4" /> Outcome <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {OUTCOMES.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  setOpen(false);
                  onPick(o.value);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50"
              >
                <span className={`h-2 w-2 rounded-full ${o.cls.split(" ")[0]}`} />
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BulkTagButton({
  onAdd,
  disabled,
}: {
  onAdd: (tag: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
      >
        <TagIcon className="h-4 w-4" /> Taguj
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 flex w-56 items-center gap-1.5 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
            <input
              autoFocus
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && val.trim()) {
                  onAdd(val.trim());
                  setVal("");
                  setOpen(false);
                }
              }}
              placeholder="nazwa tagu…"
              className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none"
            />
            <button
              onClick={() => {
                if (val.trim()) {
                  onAdd(val.trim());
                  setVal("");
                  setOpen(false);
                }
              }}
              className="rounded-md bg-gray-900 px-2 py-1 text-xs text-white hover:bg-gray-800"
            >
              Dodaj
            </button>
          </div>
        </>
      )}
    </div>
  );
}
