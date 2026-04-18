"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  api,
  ApiError,
  Campaign,
  CampaignStats,
  CampaignStatus,
  Enrollment,
  LeadList,
  PreviewResponse,
  SequenceStep,
  StepChannel,
  StepStats,
} from "@/lib/api-client";

const CHANNEL_LABELS: Record<StepChannel, string> = {
  email: "Email",
  linkedin_visit: "LinkedIn — wejście na profil",
  linkedin_invite: "LinkedIn — zaproszenie",
  linkedin_message: "LinkedIn — wiadomość",
};

const CHANNEL_BADGES: Record<StepChannel, { icon: string; label: string; cls: string }> = {
  email: {
    icon: "📧",
    label: "Email",
    cls: "bg-blue-100 text-blue-800",
  },
  linkedin_visit: {
    icon: "👁",
    label: "LI · wizyta",
    cls: "bg-sky-100 text-sky-800",
  },
  linkedin_invite: {
    icon: "➕",
    label: "LI · zaproszenie",
    cls: "bg-sky-100 text-sky-800",
  },
  linkedin_message: {
    icon: "💬",
    label: "LI · wiadomość",
    cls: "bg-sky-100 text-sky-800",
  },
};

const STATUS_OPTIONS: CampaignStatus[] = [
  "draft",
  "active",
  "paused",
  "archived",
];

const STATUS_STYLES: Record<CampaignStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-emerald-100 text-emerald-800",
  paused: "bg-amber-100 text-amber-800",
  archived: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Draft",
  active: "Aktywna",
  paused: "Pauza",
  archived: "Archiwum",
};

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const campaignId = Number(params.id);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [lists, setLists] = useState<LeadList[]>([]);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showEnrollments, setShowEnrollments] = useState(false);

  // Send-due state
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);

  // Enroll state
  const [enrollListId, setEnrollListId] = useState<number | "">("");
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState<string | null>(null);

  async function refresh() {
    try {
      const [c, s, e, l, st] = await Promise.all([
        api.campaigns.get(campaignId),
        api.campaigns.listSteps(campaignId),
        api.campaigns.listEnrollments(campaignId),
        api.lists.list(),
        api.campaigns.stats(campaignId),
      ]);
      setCampaign(c);
      setSteps(s);
      setEnrollments(e);
      setLists(l);
      setStats(st);
      if (s.length > 0 && selectedStepId === null) {
        setSelectedStepId(s[0].id);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        router.replace("/campaigns");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  async function handleStatusToggle() {
    if (!campaign) return;
    const next: CampaignStatus =
      campaign.status === "active" ? "paused" : "active";
    try {
      await api.campaigns.update(campaignId, { status: next });
      await refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Błąd");
    }
  }

  async function handleSendDueNow() {
    setSending(true);
    setSendMsg(null);
    try {
      const r = await api.campaigns.sendDueNow(campaignId);
      setSendMsg(
        r.processed > 0
          ? `Wysłano ${r.processed} maili (zobacz Mailhog :8025)`
          : "Brak enrollmentów gotowych do wysyłki (next_send_at > now())",
      );
      await refresh();
    } catch (err) {
      setSendMsg(err instanceof ApiError ? `Błąd: ${err.detail}` : "Błąd");
    } finally {
      setSending(false);
    }
  }

  async function handleEnroll(e: FormEvent) {
    e.preventDefault();
    if (enrollListId === "") return;
    setEnrolling(true);
    setEnrollMsg(null);
    try {
      const r = await api.campaigns.enrollFromList(
        campaignId,
        Number(enrollListId),
      );
      setEnrollMsg(
        `Zapisano ${r.enrolled}, pominięto duplikaty ${r.skipped_already_enrolled}`,
      );
      await refresh();
    } catch (err) {
      setEnrollMsg(err instanceof ApiError ? `Błąd: ${err.detail}` : "Błąd");
    } finally {
      setEnrolling(false);
    }
  }

  async function handleUnenroll(id: number) {
    try {
      await api.campaigns.unenroll(campaignId, id);
      await refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Błąd");
    }
  }

  const statsByStepId = useMemo(() => {
    const m = new Map<number, StepStats>();
    stats?.steps.forEach((s) => m.set(s.step_id, s));
    return m;
  }, [stats]);

  const selectedStep = useMemo(
    () => steps.find((s) => s.id === selectedStepId) ?? null,
    [steps, selectedStepId],
  );

  if (loading) return <p className="text-sm text-gray-500">Ładowanie...</p>;
  if (!campaign) return null;

  const statusStyle = STATUS_STYLES[campaign.status];
  const canToggle =
    campaign.status === "active" || campaign.status === "paused";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/campaigns"
          className="text-sm text-gray-500 hover:underline"
        >
          ← Wszystkie kampanie
        </Link>
        <div className="mt-1 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-2xl font-bold tracking-tight">
                {campaign.name}
              </h2>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${statusStyle}`}
              >
                {STATUS_LABELS[campaign.status]}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {campaign.from_name
                ? `${campaign.from_name} <${campaign.from_email}>`
                : campaign.from_email}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {canToggle && (
              <button
                onClick={handleStatusToggle}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-100"
              >
                {campaign.status === "active" ? "⏸ Pauza" : "▶ Aktywuj"}
              </button>
            )}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-100"
            >
              Ustawienia
            </button>
          </div>
        </div>

        {/* Stat strip */}
        {stats && (
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-4 md:grid-cols-6">
            <MiniStat label="Stepów" value={steps.length} />
            <MiniStat
              label="Enrollmentów"
              value={stats.enrollments.total}
            />
            <MiniStat
              label="Aktywnych"
              value={stats.enrollments.active}
            />
            <MiniStat
              label="Ukończonych"
              value={stats.enrollments.completed}
            />
            <MiniStat
              label="Wysłanych"
              value={stats.messages_sent_total}
              highlight
            />
            <MiniStat
              label="Błędów"
              value={stats.messages_failed_total}
              muted={stats.messages_failed_total === 0}
            />
          </div>
        )}
      </div>

      {/* Settings panel (collapsible) */}
      {showSettings && (
        <SettingsPanel
          campaign={campaign}
          onSaved={refresh}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Steps timeline */}
      <section className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-700">Sekwencja</h3>
        </div>
        <div className="overflow-x-auto p-4">
          <div className="flex min-w-min items-stretch gap-3">
            {steps.length === 0 && (
              <p className="py-2 text-sm text-gray-500">
                Brak stepów — dodaj pierwszy po prawej.
              </p>
            )}
            {steps.map((step, i) => (
              <div key={step.id} className="flex items-center gap-3">
                <StepCardCompact
                  step={step}
                  stats={statsByStepId.get(step.id) ?? null}
                  active={selectedStepId === step.id}
                  isFirst={i === 0}
                  onClick={() => setSelectedStepId(step.id)}
                />
                {i < steps.length - 1 && (
                  <span className="text-xl text-gray-300">→</span>
                )}
              </div>
            ))}
            {steps.length > 0 && (
              <span className="text-xl text-gray-300">→</span>
            )}
            <AddStepButton
              campaignId={campaignId}
              nextOrder={steps.length}
              onCreated={async (newId) => {
                await refresh();
                setSelectedStepId(newId);
              }}
            />
          </div>
        </div>

        {/* Step editor */}
        {selectedStep && (
          <div className="border-t border-gray-200 p-4">
            <StepEditor
              key={selectedStep.id}
              step={selectedStep}
              campaignId={campaignId}
              stats={statsByStepId.get(selectedStep.id) ?? null}
              onSaved={refresh}
              onDeleted={async () => {
                setSelectedStepId(null);
                await refresh();
              }}
            />
          </div>
        )}
      </section>

      {/* Enrollments */}
      <section className="rounded-lg border border-gray-200 bg-white">
        <button
          onClick={() => setShowEnrollments(!showEnrollments)}
          className="flex w-full items-center justify-between border-b border-gray-200 p-4 text-left hover:bg-gray-50"
        >
          <h3 className="text-sm font-medium text-gray-700">
            Enrollment leadów{" "}
            <span className="text-xs font-normal text-gray-500">
              ({enrollments.length})
            </span>
          </h3>
          <span className="text-gray-400">{showEnrollments ? "▾" : "▸"}</span>
        </button>

        {showEnrollments && (
          <div className="space-y-3 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <form onSubmit={handleEnroll} className="flex items-end gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    Wybierz listę
                  </label>
                  <select
                    value={enrollListId}
                    onChange={(e) =>
                      setEnrollListId(
                        e.target.value === ""
                          ? ""
                          : Number(e.target.value),
                      )
                    }
                    className="mt-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  >
                    <option value="">— wybierz —</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.leads_count})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={enrollListId === "" || enrolling}
                  className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {enrolling ? "Zapisuję..." : "Zapisz wszystkich"}
                </button>
              </form>

              <button
                onClick={handleSendDueNow}
                disabled={sending || enrollments.length === 0}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-50"
                title="Wyślij enrollmenty z next_send_at <= now()"
              >
                {sending ? "Wysyłam..." : "Wyślij due teraz"}
              </button>
            </div>

            {enrollMsg && (
              <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700">
                {enrollMsg}
              </p>
            )}
            {sendMsg && (
              <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700">
                {sendMsg}
              </p>
            )}

            {enrollments.length === 0 ? (
              <p className="text-sm text-gray-500">Brak enrollmentów.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">
                        Lead
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">
                        Firma
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">
                        Status
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">
                        Step
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">
                        Następna wysyłka
                      </th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {enrollments.map((e) => (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <div className="text-gray-900">{e.lead_email}</div>
                          {e.lead_name && (
                            <div className="text-xs text-gray-500">
                              {e.lead_name}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-700">
                          {e.lead_company || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                            {e.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {e.current_step}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {e.next_send_at
                            ? new Date(e.next_send_at).toLocaleString("pl-PL")
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => handleUnenroll(e.id)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Usuń
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Preview */}
      {steps.length > 0 && enrollments.length > 0 && (
        <PreviewSection
          campaignId={campaignId}
          steps={steps}
          enrollments={enrollments}
        />
      )}
    </div>
  );
}

// ---------- Small pieces ----------

function MiniStat({
  label,
  value,
  highlight = false,
  muted = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p
        className={
          "mt-0.5 text-xl font-bold " +
          (highlight
            ? "text-emerald-700"
            : muted
              ? "text-gray-400"
              : "text-gray-900")
        }
      >
        {value}
      </p>
    </div>
  );
}

function SettingsPanel({
  campaign,
  onSaved,
  onClose,
}: {
  campaign: Campaign;
  onSaved: () => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(campaign.name);
  const [fromEmail, setFromEmail] = useState(campaign.from_email);
  const [fromName, setFromName] = useState(campaign.from_name ?? "");
  const [status, setStatus] = useState<CampaignStatus>(campaign.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.campaigns.update(campaign.id, {
        name,
        from_email: fromEmail,
        from_name: fromName || undefined,
        status,
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd zapisu");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="space-y-3 rounded-lg border border-gray-200 bg-white p-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          Ustawienia kampanii
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-gray-500 hover:text-gray-900"
        >
          Zwiń
        </button>
      </div>
      <input
        type="text"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nazwa"
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <input
          type="email"
          required
          value={fromEmail}
          onChange={(e) => setFromEmail(e.target.value)}
          placeholder="from email"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={fromName}
          onChange={(e) => setFromName(e.target.value)}
          placeholder="from name"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as CampaignStatus)}
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        disabled={saving}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? "Zapisywanie..." : "Zapisz"}
      </button>
    </form>
  );
}

function StepCardCompact({
  step,
  stats,
  active,
  isFirst,
  onClick,
}: {
  step: SequenceStep;
  stats: StepStats | null;
  active: boolean;
  isFirst: boolean;
  onClick: () => void;
}) {
  const channel = CHANNEL_BADGES[step.channel];
  const isEmail = step.channel === "email";

  return (
    <button
      onClick={onClick}
      className={
        "w-60 shrink-0 rounded-lg border p-3 text-left transition " +
        (active
          ? "border-gray-900 bg-white shadow-sm ring-2 ring-gray-900/10"
          : "border-gray-200 bg-white hover:border-gray-400")
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase text-gray-500">
          Step {step.step_order}
        </span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
          {isFirst ? "od enrollmentu" : "+"}
          {step.delay_days}
          {"d"}
        </span>
      </div>
      <div className="mt-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${channel.cls}`}>
          <span>{channel.icon}</span>
          <span>{channel.label}</span>
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium text-gray-900">
        {step.subject}
      </p>
      <p className="mt-1 line-clamp-2 whitespace-pre-wrap font-mono text-xs text-gray-500">
        {step.body_template}
      </p>
      {isEmail ? (
        <div className="mt-2 flex items-center gap-3 text-xs">
          <span className="text-emerald-700">
            ✓ {stats?.sent_count ?? 0}
          </span>
          {stats && stats.failed_count > 0 && (
            <span className="text-red-600">✗ {stats.failed_count}</span>
          )}
        </div>
      ) : (
        <div className="mt-2 text-xs text-gray-400">
          manual — user wykonuje
        </div>
      )}
    </button>
  );
}

function AddStepButton({
  campaignId,
  nextOrder,
  onCreated,
}: {
  campaignId: number;
  nextOrder: number;
  onCreated: (id: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<StepChannel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [delay, setDelay] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const created = await api.campaigns.createStep(campaignId, {
        step_order: nextOrder,
        subject,
        body_template: body,
        delay_days: delay,
        channel,
      });
      setChannel("email");
      setSubject("");
      setBody("");
      setDelay(0);
      setOpen(false);
      await onCreated(created.id);
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : "Błąd");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-40 shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500 hover:border-gray-500 hover:text-gray-900"
      >
        <span className="text-2xl">+</span>
        Dodaj step
      </button>
    );
  }

  return (
    <form
      onSubmit={handleCreate}
      className="w-72 shrink-0 space-y-2 rounded-lg border border-gray-900 bg-white p-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700">
          Nowy step #{nextOrder}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-gray-500 hover:text-gray-900"
        >
          ✕
        </button>
      </div>
      <select
        value={channel}
        onChange={(e) => setChannel(e.target.value as StepChannel)}
        className="block w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
      >
        {(Object.keys(CHANNEL_LABELS) as StepChannel[]).map((c) => (
          <option key={c} value={c}>
            {CHANNEL_LABELS[c]}
          </option>
        ))}
      </select>
      <input
        type="text"
        required
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder={
          channel === "email"
            ? "Subject (np. Quick q, {{first_name}})"
            : "Tytuł / notatka wewnętrzna"
        }
        className="block w-full rounded-md border border-gray-300 px-2 py-1 text-xs font-mono"
      />
      <textarea
        required
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder={
          channel === "email"
            ? "Body — {{first_name}} {{company}} ..."
            : channel === "linkedin_invite"
              ? "Treść notki do zaproszenia (max ~300 znaków)"
              : channel === "linkedin_message"
                ? "Treść wiadomości do wysłania ręcznie"
                : "Notatka (np. 'sprawdź ostatnie posty')"
        }
        className="block w-full rounded-md border border-gray-300 px-2 py-1 text-xs font-mono"
      />
      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-600">Delay (dni):</label>
        <input
          type="number"
          min={0}
          max={365}
          value={delay}
          onChange={(e) => setDelay(Number(e.target.value))}
          className="w-16 rounded-md border border-gray-300 px-2 py-1 text-xs"
        />
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <button
        disabled={saving}
        className="w-full rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? "..." : "Dodaj"}
      </button>
    </form>
  );
}

function StepEditor({
  step,
  campaignId,
  stats,
  onSaved,
  onDeleted,
}: {
  step: SequenceStep;
  campaignId: number;
  stats: StepStats | null;
  onSaved: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [channel, setChannel] = useState<StepChannel>(step.channel);
  const [subject, setSubject] = useState(step.subject);
  const [body, setBody] = useState(step.body_template);
  const [delay, setDelay] = useState(step.delay_days);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.campaigns.updateStep(campaignId, step.id, {
        channel,
        subject,
        body_template: body,
        delay_days: delay,
      });
      await onSaved();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Błąd");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Usunąć ten step?")) return;
    try {
      await api.campaigns.deleteStep(campaignId, step.id);
      await onDeleted();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Błąd");
    }
  }

  const dirty =
    channel !== step.channel ||
    subject !== step.subject ||
    body !== step.body_template ||
    delay !== step.delay_days;

  const isEmail = channel === "email";

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">
          Edycja step #{step.step_order}
          {isEmail && stats && (
            <span className="ml-2 text-xs font-normal text-gray-500">
              ✓ {stats.sent_count} wysłanych
              {stats.failed_count > 0 && (
                <> · ✗ {stats.failed_count} błędów</>
              )}
            </span>
          )}
          {!isEmail && (
            <span className="ml-2 text-xs font-normal text-gray-500">
              manual — user wykonuje ręcznie
            </span>
          )}
        </h4>
        <button
          type="button"
          onClick={handleDelete}
          className="text-xs text-red-600 hover:underline"
        >
          Usuń step
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-gray-700">Kanał:</label>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as StepChannel)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {(Object.keys(CHANNEL_LABELS) as StepChannel[]).map((c) => (
            <option key={c} value={c}>
              {CHANNEL_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      {!isEmail && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Worker pomija tego stepa — przesuwa enrollment dalej bez wysyłki.
          Zadanie wykonujesz ręcznie w LinkedIn, poniżej trzymamy treść do
          skopiowania.
        </p>
      )}

      <input
        type="text"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder={isEmail ? "Subject" : "Tytuł / notatka wewnętrzna"}
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={8}
        placeholder={
          isEmail
            ? "Body"
            : channel === "linkedin_invite"
              ? "Treść zaproszenia (max ~300 znaków)"
              : channel === "linkedin_message"
                ? "Treść wiadomości"
                : "Notatka (np. 'polajkować ostatni post')"
        }
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
      />
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-700">Delay (dni):</label>
        <input
          type="number"
          min={0}
          max={365}
          value={delay}
          onChange={(e) => setDelay(Number(e.target.value))}
          className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        disabled={saving || !dirty}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? "Zapisywanie..." : dirty ? "Zapisz zmiany" : "Bez zmian"}
      </button>
    </form>
  );
}

function PreviewSection({
  campaignId,
  steps,
  enrollments,
}: {
  campaignId: number;
  steps: SequenceStep[];
  enrollments: Enrollment[];
}) {
  const [stepId, setStepId] = useState<number | "">("");
  const [leadId, setLeadId] = useState<number | "">("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview(e: FormEvent) {
    e.preventDefault();
    if (stepId === "" || leadId === "") return;
    setError(null);
    setPreview(null);
    try {
      const p = await api.campaigns.preview(
        campaignId,
        Number(stepId),
        Number(leadId),
      );
      setPreview(p);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd");
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-700">Preview</h3>
      </div>
      <div className="space-y-3 p-4">
        <form
          onSubmit={handlePreview}
          className="flex flex-wrap items-end gap-3"
        >
          <div>
            <label className="block text-xs font-medium text-gray-700">
              Step
            </label>
            <select
              value={stepId}
              onChange={(e) =>
                setStepId(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="mt-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">— wybierz —</option>
              {steps.map((s) => (
                <option key={s.id} value={s.id}>
                  [{s.step_order}] {s.subject.slice(0, 40)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700">
              Lead
            </label>
            <select
              value={leadId}
              onChange={(e) =>
                setLeadId(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="mt-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">— wybierz —</option>
              {enrollments.map((e) => (
                <option key={e.lead_id} value={e.lead_id}>
                  {e.lead_email}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={stepId === "" || leadId === ""}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
          >
            Renderuj
          </button>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {preview && (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-medium uppercase text-gray-500">
              Subject
            </p>
            <p className="mt-1 font-medium text-gray-900">{preview.subject}</p>
            <p className="mt-3 text-xs font-medium uppercase text-gray-500">
              Body
            </p>
            <pre className="mt-1 whitespace-pre-wrap font-mono text-sm text-gray-900">
              {preview.body}
            </pre>
          </div>
        )}
      </div>
    </section>
  );
}
