"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  GitBranch,
  ListOrdered,
  Pause,
  Play,
  Send as SendIcon,
  Settings2,
  Users2,
  XCircle,
} from "lucide-react";

import {
  api,
  ApiError,
  AudienceCriteria,
  AudienceLead,
  AudiencePreview,
  Campaign,
  CampaignGroup,
  CampaignPipelineStage,
  CampaignStats,
  CampaignStatus,
  EmailAccount,
  Enrollment,
  LeadList,
  PreviewResponse,
  SequenceScore,
  SequenceStep,
  SignalSummary,
  StepChannel,
  StepStats,
  StepVariant,
} from "@/lib/api-client";
import { StepsTab } from "@/components/sequence-steps";
import { ProspectsTab } from "@/components/prospects";
import { SubsequenceTab } from "@/components/subsequence";

const CHANNEL_LABELS: Record<StepChannel, string> = {
  email: "Email",
  linkedin_visit: "LinkedIn — wejście na profil",
  linkedin_invite: "LinkedIn — zaproszenie",
  linkedin_message: "LinkedIn — wiadomość",
  call: "Telefon",
  whatsapp: "WhatsApp",
  task: "Zadanie",
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
  call: { icon: "📞", label: "Telefon", cls: "bg-emerald-100 text-emerald-800" },
  whatsapp: { icon: "🟢", label: "WhatsApp", cls: "bg-green-100 text-green-800" },
  task: { icon: "✅", label: "Zadanie", cls: "bg-amber-100 text-amber-800" },
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

type TabKey = "kroki" | "odbiorcy" | "subsequence" | "ustawienia";

function SeqScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "text-emerald-600"
      : score >= 50
        ? "text-amber-500"
        : "text-gray-400";
  const ring =
    score >= 80
      ? "#10b981"
      : score >= 50
        ? "#f59e0b"
        : "#9ca3af";
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(${ring} ${score * 3.6}deg, #e5e7eb 0deg)`,
      }}
      title="Sequence Score — jakość sekwencji"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
        <span className={`text-sm font-bold ${color}`}>{score}</span>
      </div>
    </div>
  );
}

function ScoreBreakdown({
  score,
  onClose,
}: {
  score: SequenceScore;
  onClose: () => void;
}) {
  const tone =
    score.score >= 80
      ? "text-emerald-600"
      : score.score >= 50
        ? "text-amber-600"
        : "text-red-600";
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            Sequence Score{" "}
            <span className={`ml-1 font-bold ${tone}`}>
              {score.score}/{score.max_score}
            </span>
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Jakość sekwencji — popraw pozycje z minusem, by zwiększyć wynik.
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-gray-500 hover:text-gray-900"
        >
          Zwiń
        </button>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {score.factors.map((f) => (
          <div
            key={f.key}
            className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50/50 p-2.5"
          >
            {f.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-800">
                  {f.label}
                </span>
                <span
                  className={
                    "shrink-0 font-mono text-xs " +
                    (f.points === f.max
                      ? "text-emerald-600"
                      : f.points === 0
                        ? "text-gray-400"
                        : "text-amber-600")
                  }
                >
                  {f.points}/{f.max}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">{f.hint}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeqTabs({
  tab,
  onChange,
  done,
}: {
  tab: TabKey;
  onChange: (t: TabKey) => void;
  done: { kroki: boolean; odbiorcy: boolean };
}) {
  const items: { key: TabKey; label: string; icon: typeof ListOrdered }[] = [
    { key: "kroki", label: "Kroki", icon: ListOrdered },
    { key: "odbiorcy", label: "Odbiorcy", icon: Users2 },
    { key: "subsequence", label: "Subsequence", icon: GitBranch },
    { key: "ustawienia", label: "Ustawienia", icon: Settings2 },
  ];
  return (
    <div className="flex gap-1 border-b border-gray-200">
      {items.map(({ key, label, icon: Icon }) => {
        const active = tab === key;
        const isDone = key === "kroki" ? done.kroki : key === "odbiorcy" ? done.odbiorcy : false;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={
              "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors " +
              (active
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-900")
            }
          >
            {isDone ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <Icon className="h-4 w-4" />
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const campaignId = Number(params.id);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [lists, setLists] = useState<LeadList[]>([]);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [score, setScore] = useState<SequenceScore | null>(null);
  const [showScore, setShowScore] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  const [tab, setTab] = useState<TabKey>("kroki");
  const [showPipeline, setShowPipeline] = useState(false);

  // Send-due state
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);

  // Audience builder state
  const [sources, setSources] = useState<SignalSummary[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState<string | null>(null);

  async function refresh() {
    try {
      const [c, s, e, l, st, srcs, sc] = await Promise.all([
        api.campaigns.get(campaignId),
        api.campaigns.listSteps(campaignId),
        api.campaigns.listEnrollments(campaignId),
        api.lists.list(),
        api.campaigns.stats(campaignId),
        api.signals.summary(),
        api.campaigns.score(campaignId).catch(() => null),
      ]);
      setCampaign(c);
      setSteps(s);
      setEnrollments(e);
      setLists(l);
      setStats(st);
      setSources(srcs);
      setScore(sc);
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
          ? `Wysłano ${r.processed} maili.`
          : "Brak leadów gotowych do wysyłki w tym momencie (następna wysyłka zaplanowana później).",
      );
      await refresh();
    } catch (err) {
      setSendMsg(err instanceof ApiError ? `Błąd: ${err.detail}` : "Błąd");
    } finally {
      setSending(false);
    }
  }

  async function handleAudienceEnroll(leadIds: number[]) {
    setEnrollMsg(null);
    try {
      const r = await api.campaigns.audienceEnroll(campaignId, leadIds);
      setEnrollMsg(
        `Zapisano ${r.enrolled}, pominięto duplikaty ${r.skipped_already_enrolled}`,
      );
      setShowBuilder(false);
      await refresh();
    } catch (err) {
      setEnrollMsg(err instanceof ApiError ? `Błąd: ${err.detail}` : "Błąd");
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

  const seqScore = score?.score ?? 0;

  if (loading) return <p className="text-sm text-gray-500">Ładowanie...</p>;
  if (!campaign) return null;

  const statusStyle = STATUS_STYLES[campaign.status];
  const canToggle =
    campaign.status === "active" || campaign.status === "paused";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-4">
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Sekwencje
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setShowScore((v) => !v)}
              title="Sequence Score — kliknij, by zobaczyć rozbicie"
              className="rounded-full transition hover:opacity-80"
            >
              <SeqScoreBadge score={seqScore} />
            </button>
            <div className="min-w-0">
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
              <p className="mt-0.5 text-sm text-gray-500">
                {campaign.from_name
                  ? `${campaign.from_name} <${campaign.from_email}>`
                  : campaign.from_email}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={handleSendDueNow}
              disabled={sending || enrollments.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-50"
            >
              <SendIcon className="h-3.5 w-3.5" />
              {sending ? "Wysyłam…" : "Wyślij należne"}
            </button>
            {canToggle && (
              <button
                onClick={handleStatusToggle}
                className={
                  "inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium text-white " +
                  (campaign.status === "active"
                    ? "bg-amber-500 hover:bg-amber-600"
                    : "bg-emerald-600 hover:bg-emerald-700")
                }
              >
                {campaign.status === "active" ? (
                  <>
                    <Pause className="h-3.5 w-3.5" /> Pauza
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" /> Uruchom sekwencję
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Stat strip */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:grid-cols-4 md:grid-cols-6">
            <MiniStat label="Kroków" value={steps.length} />
            <MiniStat label="Odbiorców" value={stats.enrollments.total} />
            <MiniStat label="Aktywnych" value={stats.enrollments.active} />
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

        {showScore && score && (
          <ScoreBreakdown score={score} onClose={() => setShowScore(false)} />
        )}

        <SeqTabs
          tab={tab}
          onChange={setTab}
          done={{
            kroki: steps.length > 0,
            odbiorcy: enrollments.length > 0,
          }}
        />
      </div>

      {sendMsg && (
        <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700">
          {sendMsg}
        </p>
      )}

      {/* TAB: Ustawienia */}
      {tab === "ustawienia" && (
        <SettingsPanel
          campaign={campaign}
          onSaved={refresh}
          onClose={() => setTab("kroki")}
        />
      )}

      {/* TAB: Kroki */}
      {tab === "kroki" && (
        <StepsTab
          campaignId={campaignId}
          campaign={campaign}
          steps={steps}
          statsByStepId={statsByStepId}
          refresh={refresh}
        />
      )}

      {/* TAB: Subsequence */}
      {tab === "subsequence" && (
        <SubsequenceTab campaignId={campaignId} steps={steps} />
      )}

      {/* TAB: Odbiorcy */}
      {tab === "odbiorcy" && (
        <div className="space-y-5">
          {stats && stats.enrollments.total > 0 && (
            <CampaignPipelineSection
              stages={stats.pipeline}
              open={showPipeline}
              onToggle={() => setShowPipeline(!showPipeline)}
            />
          )}
          {showBuilder && (
            <AudienceBuilder
              campaignId={campaignId}
              lists={lists}
              sources={sources}
              onEnroll={handleAudienceEnroll}
              onCancel={() => setShowBuilder(false)}
            />
          )}

          {enrollMsg && (
            <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700">
              {enrollMsg}
            </p>
          )}

          <ProspectsTab
            campaignId={campaignId}
            enrollments={enrollments}
            funnel={stats?.funnel ?? null}
            onRefresh={refresh}
            onAddLeads={() => setShowBuilder((s) => !s)}
            builderOpen={showBuilder}
          />

          {steps.length > 0 && enrollments.length > 0 && (
            <PreviewSection
              campaignId={campaignId}
              steps={steps}
              enrollments={enrollments}
            />
          )}
        </div>
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

const DOW: [string, number][] = [
  ["Pn", 1],
  ["Wt", 2],
  ["Śr", 3],
  ["Cz", 4],
  ["Pt", 5],
  ["So", 6],
  ["Nd", 7],
];

function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function localInputToIso(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

const PRIORITIES: { value: string; label: string; desc: string }[] = [
  {
    value: "prioritise_followups",
    label: "Follow-upy",
    desc: "Najpierw dosyłaj kolejne kroki istniejącym odbiorcom.",
  },
  {
    value: "prioritise_new",
    label: "Nowi odbiorcy",
    desc: "Najpierw kontaktuj się z nowymi prospektami.",
  },
  {
    value: "balanced",
    label: "Zrównoważony",
    desc: "Równo rozkładaj wysyłkę między krokami.",
  },
  {
    value: "aggressive",
    label: "Agresywny",
    desc: "Maksymalizuj dzienny wolumen w ramach limitów.",
  },
];

function SettingsToggle({
  checked,
  onChange,
  title,
  desc,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  desc: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{title}</p>
        <p className="mt-0.5 text-xs text-gray-500">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={
          "relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition " +
          (checked ? "bg-emerald-500" : "bg-gray-300")
        }
      >
        <span
          className={
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all " +
            (checked ? "left-4" : "left-0.5")
          }
        />
      </button>
    </label>
  );
}

function SettingsSection({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {desc && <p className="mt-0.5 text-xs text-gray-500">{desc}</p>}
      <div className="mt-3">{children}</div>
    </section>
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
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);

  useEffect(() => {
    api.emailAccounts
      .list()
      .then((a) => setAccounts(a.filter((x) => x.active)))
      .catch(() => setAccounts([]));
  }, []);
  const [status, setStatus] = useState<CampaignStatus>(campaign.status);
  const [scheduledLocal, setScheduledLocal] = useState(
    isoToLocalInput(campaign.scheduled_at),
  );
  const [startHour, setStartHour] = useState(campaign.send_window_start_hour);
  const [endHour, setEndHour] = useState(campaign.send_window_end_hour);
  const [days, setDays] = useState<Set<number>>(
    new Set(campaign.send_days.split(",").map(Number).filter(Boolean)),
  );
  const [includeUnsub, setIncludeUnsub] = useState(
    campaign.include_unsubscribe,
  );
  const [unsubText, setUnsubText] = useState(campaign.unsubscribe_text ?? "");
  const [trackOpens, setTrackOpens] = useState(campaign.track_opens);
  const [stopOnReply, setStopOnReply] = useState(campaign.stop_on_reply);
  const [trackClicks, setTrackClicks] = useState(campaign.track_clicks);
  const [textOnly, setTextOnly] = useState(campaign.text_only);
  const [sameThread, setSameThread] = useState(campaign.same_thread);
  const [cc, setCc] = useState(campaign.cc ?? "");
  const [bcc, setBcc] = useState(campaign.bcc ?? "");
  const [priority, setPriority] = useState(campaign.sending_priority);
  const [dealValue, setDealValue] = useState<string>(
    campaign.deal_value != null ? String(campaign.deal_value) : "",
  );
  const [groupId, setGroupId] = useState<number | "">(campaign.group_id ?? "");
  const [groups, setGroups] = useState<CampaignGroup[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.groups.list().then(setGroups).catch(() => {});
  }, []);

  function toggleDay(d: number) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

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
        scheduled_at: localInputToIso(scheduledLocal),
        send_window_start_hour: startHour,
        send_window_end_hour: endHour,
        send_days:
          Array.from(days).sort((a, b) => a - b).join(",") || "1,2,3,4,5,6,7",
        include_unsubscribe: includeUnsub,
        unsubscribe_text: unsubText || null,
        track_opens: trackOpens,
        stop_on_reply: stopOnReply,
        track_clicks: trackClicks,
        text_only: textOnly,
        same_thread: sameThread,
        cc: cc.trim() || null,
        bcc: bcc.trim() || null,
        sending_priority: priority,
        deal_value: dealValue.trim() === "" ? null : Number(dealValue),
        group_id: groupId === "" ? null : Number(groupId),
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
    <form onSubmit={handleSave} className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-900">
          Ustawienia sekwencji
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-gray-500 hover:text-gray-900"
        >
          Zwiń
        </button>
      </div>

      {/* Ogólne */}
      <SettingsSection title="Ogólne">
        <div className="space-y-3">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nazwa sekwencji"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                Status
              </label>
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
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                Kampania (parasol)
              </label>
              <select
                value={groupId}
                onChange={(e) =>
                  setGroupId(e.target.value === "" ? "" : Number(e.target.value))
                }
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">— bez kampanii —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Konto wysyłkowe */}
      <SettingsSection
        title="Konto wysyłkowe"
        desc="Adres, z którego wychodzą maile tej sekwencji. Rotacja wielu skrzynek — wkrótce."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
              Skrzynka wysyłkowa
            </label>
            {accounts.length > 0 ? (
              <select
                required
                value={fromEmail}
                onChange={(e) => {
                  setFromEmail(e.target.value);
                  const a = accounts.find((x) => x.email === e.target.value);
                  if (a?.from_name) setFromName(a.from_name);
                }}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {!accounts.some((a) => a.email === fromEmail) && (
                  <option value={fromEmail}>
                    {fromEmail} (niepodłączona)
                  </option>
                )}
                {accounts.map((a) => (
                  <option key={a.id} value={a.email}>
                    {a.email}
                    {a.verified
                      ? " ✓"
                      : a.has_password
                        ? " (nietestowana)"
                        : " (brak hasła)"}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="email"
                required
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
              From name
            </label>
            <input
              type="text"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="np. Daniel z MOATION"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </SettingsSection>

      {/* Harmonogram wysyłki */}
      <SettingsSection
        title="Harmonogram wysyłki"
        desc="Kiedy startuje sekwencja i w jakich godzinach/dniach wychodzą maile (UTC)."
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
              Zaplanuj start (data i godzina)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={scheduledLocal}
                onChange={(e) => setScheduledLocal(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              {scheduledLocal && (
                <button
                  type="button"
                  onClick={() => setScheduledLocal("")}
                  className="text-xs text-gray-500 underline hover:text-gray-900"
                >
                  Wyczyść (wysyłaj od razu)
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Puste = pierwszy krok rusza zaraz po zapisaniu leadów. Przyszła data
              = pierwszy krok czeka do tego momentu.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
              Okno wysyłki
            </label>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-gray-600">od</span>
              <input
                type="number"
                min={0}
                max={24}
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
                className="w-16 rounded-md border border-gray-300 px-2 py-1"
              />
              <span className="text-gray-600">do</span>
              <input
                type="number"
                min={0}
                max={24}
                value={endHour}
                onChange={(e) => setEndHour(Number(e.target.value))}
                className="w-16 rounded-md border border-gray-300 px-2 py-1"
              />
              <span className="text-gray-400">godz.</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DOW.map(([label, d]) => {
                const on = days.has(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={
                      "rounded-full border px-2.5 py-1 text-xs transition " +
                      (on
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-500")
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Priorytet wysyłki */}
      <SettingsSection
        title="Priorytet wysyłki"
        desc="Jak rozkładać dzienny limit między nowymi prospektami a follow-upami."
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PRIORITIES.map((p) => {
            const active = priority === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={
                  "rounded-lg border p-3 text-left transition " +
                  (active
                    ? "border-gray-900 ring-1 ring-gray-900/10"
                    : "border-gray-200 hover:border-gray-400")
                }
              >
                <div className="flex items-center gap-2">
                  <span
                    className={
                      "h-3.5 w-3.5 rounded-full border-2 " +
                      (active ? "border-gray-900 bg-gray-900" : "border-gray-300")
                    }
                  />
                  <span className="text-sm font-medium text-gray-900">
                    {p.label}
                  </span>
                </div>
                <p className="mt-1 pl-5 text-xs text-gray-500">{p.desc}</p>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      {/* Bezpieczeństwo i śledzenie */}
      <SettingsSection
        title="Bezpieczeństwo i śledzenie"
        desc="Zachowanie sekwencji i dostarczalność."
      >
        <div className="divide-y divide-gray-100">
          <SettingsToggle
            checked={stopOnReply}
            onChange={setStopOnReply}
            title="Zatrzymaj follow-upy po odpowiedzi"
            desc="Gdy prospekt odpowie, nie wysyłaj kolejnych kroków. (działa z wykrywaniem odpowiedzi — IMAP wkrótce)"
          />
          <SettingsToggle
            checked={trackOpens}
            onChange={setTrackOpens}
            title="Śledź otwarcia (pixel)"
            desc="Pokazuje, kto otworzył maila. Wymaga wersji HTML — może lekko obniżyć dostarczalność."
          />
          <SettingsToggle
            checked={trackClicks}
            onChange={setTrackClicks}
            title="Śledź kliknięcia linków"
            desc="Przepisuje linki w mailu przez podpisany tracker — kliknięcia liczą się per krok i per odbiorca."
          />
          <SettingsToggle
            checked={textOnly}
            onChange={setTextOnly}
            title="Wysyłaj tylko tekst (bez HTML)"
            desc="Lepsza dostarczalność dla pierwszego maila. Wyłącza pixel otwarć."
          />
          <SettingsToggle
            checked={sameThread}
            onChange={setSameThread}
            title="Wysyłaj w tym samym wątku"
            desc="Kolejne kroki dosyłane jako odpowiedź w wątku pierwszego maila. (nagłówki References — wkrótce)"
          />
        </div>
      </SettingsSection>

      {/* Cc & Bcc */}
      <SettingsSection
        title="Cc i Bcc"
        desc="Stałe adresy dodawane do każdego maila w sekwencji (oddziel przecinkami)."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
              Cc
            </label>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="kopia@firma.pl, ktos@firma.pl"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
              Bcc
            </label>
            <input
              type="text"
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              placeholder="crm@firma.pl"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </SettingsSection>

      {/* Wartość deala */}
      <SettingsSection
        title="Wartość deala"
        desc="Szacowana wartość pojedynczego prospekta — zasila przychód pipeline'u (Interested/Meeting/Closed)."
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">PLN</span>
          <input
            type="number"
            min={0}
            value={dealValue}
            onChange={(e) => setDealValue(e.target.value)}
            placeholder="np. 5000"
            className="w-40 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </SettingsSection>

      {/* Wypis */}
      <SettingsSection
        title="Wypis (unsubscribe)"
        desc="Stopka wymagana prawnie przy cold mailingu — poprawia też dostarczalność."
      >
        <div className="space-y-2">
          <SettingsToggle
            checked={includeUnsub}
            onChange={setIncludeUnsub}
            title="Dołącz stopkę wypisu"
            desc="Dopisywana na końcu każdego maila."
          />
          {includeUnsub && (
            <textarea
              value={unsubText}
              onChange={(e) => setUnsubText(e.target.value)}
              rows={2}
              placeholder="Jeśli nie chcesz otrzymywać kolejnych wiadomości, odpisz STOP."
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          )}
        </div>
      </SettingsSection>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="sticky bottom-0 -mx-1 flex justify-end border-t border-gray-200 bg-gray-50/80 px-1 py-3 backdrop-blur">
        <button
          disabled={saving}
          className="rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? "Zapisywanie..." : "Zapisz ustawienia"}
        </button>
      </div>
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
          <span className="text-gray-500">👁 {stats?.opened_count ?? 0}</span>
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

  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );

  async function handleTestSend() {
    setTesting(true);
    setTestMsg(null);
    try {
      const r = await api.campaigns.testSendStep(
        campaignId,
        step.id,
        testTo || undefined,
      );
      setTestMsg({
        ok: true,
        text: `Wysłano test na ${r.sent_to}. Sprawdź skrzynkę (także spam).`,
      });
    } catch (err) {
      setTestMsg({
        ok: false,
        text: err instanceof ApiError ? err.detail : "Błąd wysyłki testu",
      });
    } finally {
      setTesting(false);
    }
  }

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
    <div className="space-y-4">
    <form onSubmit={handleSave} className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">
          Edycja step #{step.step_order}
          {isEmail && stats && (
            <span className="ml-2 text-xs font-normal text-gray-500">
              ✓ {stats.sent_count} wysłanych · 👁 {stats.opened_count} otwarć
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
      <p className="text-xs text-gray-400">
        Personalizacja: <code className="rounded bg-gray-100 px-1">{"{{first_name}}"}</code>{" "}
        <code className="rounded bg-gray-100 px-1">{"{{company}}"}</code>{" "}
        <code className="rounded bg-gray-100 px-1">{"{{title}}"}</code>. Spintax
        (warianty słów):{" "}
        <code className="rounded bg-gray-100 px-1">
          {"{spin Cześć|Hej|Dzień dobry endspin}"}
        </code>{" "}
        — każdy odbiorca dostaje losowy, ale stały wariant (lepsza
        dostarczalność).
      </p>

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

    {isEmail && <VariantsSection campaignId={campaignId} stepId={step.id} />}

    {isEmail && (
      <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
        <p className="text-xs font-medium uppercase text-gray-500">
          Wyślij testowy mail
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="Adres testowy (domyślnie Twoje konto)"
            className="min-w-[220px] flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={handleTestSend}
            disabled={testing}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-100 disabled:opacity-50"
          >
            {testing ? "Wysyłam…" : "Wyślij test"}
          </button>
        </div>
        {testMsg && (
          <p
            className={
              "rounded-md px-3 py-2 text-sm " +
              (testMsg.ok
                ? "bg-emerald-50 text-emerald-800"
                : "bg-red-50 text-red-700")
            }
          >
            {testMsg.text}
          </p>
        )}
        <p className="text-xs text-gray-400">
          Renderuje ten krok na przykładowych danych (np. {"{{first_name}}"} →
          Jan) i wysyła z Twojej skrzynki. Wymaga skonfigurowanego SMTP
          (Integracje).
        </p>
      </div>
    )}
    </div>
  );
}

function VariantsSection({
  campaignId,
  stepId,
}: {
  campaignId: number;
  stepId: number;
}) {
  const [variants, setVariants] = useState<StepVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [genLoading, setGenLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [vSubject, setVSubject] = useState("");
  const [vBody, setVBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function refresh() {
    try {
      setVariants(await api.campaigns.listVariants(campaignId, stepId));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId]);

  async function genAi() {
    setGenLoading(true);
    setErr(null);
    try {
      await api.campaigns.generateAiVariant(campaignId, stepId);
      await refresh();
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : "Błąd generowania wariantu");
    } finally {
      setGenLoading(false);
    }
  }

  async function addManual(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await api.campaigns.createVariant(campaignId, stepId, {
        subject: vSubject,
        body_template: vBody,
      });
      setVSubject("");
      setVBody("");
      setShowForm(false);
      await refresh();
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : "Błąd zapisu wariantu");
    } finally {
      setSaving(false);
    }
  }

  async function del(id: number) {
    try {
      await api.campaigns.deleteVariant(campaignId, stepId, id);
      await refresh();
    } catch (e) {
      alert(e instanceof ApiError ? e.detail : "Błąd");
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase text-gray-500">
          Warianty A/B
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={genAi}
            disabled={genLoading}
            className="rounded-md bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {genLoading ? "Generuję…" : "✨ Generuj wariant AI"}
          </button>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="rounded-md border border-gray-300 px-2.5 py-1 text-xs hover:bg-gray-100"
          >
            + Dodaj ręcznie
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400">
        Wariant A = treść powyżej. Dodatkowe warianty rotują losowo per odbiorca
        (stały wybór dla danej osoby).
      </p>

      {err && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={addManual}
          className="space-y-2 rounded-md border border-gray-200 p-2"
        >
          <input
            value={vSubject}
            onChange={(e) => setVSubject(e.target.value)}
            required
            placeholder="Temat wariantu"
            className="block w-full rounded-md border border-gray-300 px-2 py-1 text-xs font-mono"
          />
          <textarea
            value={vBody}
            onChange={(e) => setVBody(e.target.value)}
            required
            rows={4}
            placeholder="Treść wariantu (możesz użyć {{first_name}} i spintax)"
            className="block w-full rounded-md border border-gray-300 px-2 py-1 text-xs font-mono"
          />
          <button
            disabled={saving}
            className="rounded-md bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "Zapisuję…" : "Zapisz wariant"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-gray-400">Ładowanie…</p>
      ) : variants.length === 0 ? (
        <p className="text-xs text-gray-400">
          Brak dodatkowych wariantów (wysyłany jest tylko A).
        </p>
      ) : (
        <ul className="space-y-2">
          {variants.map((v, i) => (
            <li key={v.id} className="rounded-md border border-gray-200 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-700">
                    Wariant {String.fromCharCode(66 + i)}
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {v.subject}
                  </p>
                  <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap font-mono text-xs text-gray-500">
                    {v.body_template}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => del(v.id)}
                  className="shrink-0 text-xs text-red-600 hover:underline"
                >
                  Usuń
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CampaignPipelineSection({
  stages,
  open,
  onToggle,
}: {
  stages: CampaignPipelineStage[];
  open: boolean;
  onToggle: () => void;
}) {
  const total = stages.reduce((a, s) => a + s.companies_count, 0);

  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between border-b border-gray-200 p-4 text-left hover:bg-gray-50"
      >
        <div>
          <h3 className="text-sm font-medium text-gray-700">
            📈 Pipeline kampanii{" "}
            <span className="text-xs font-normal text-gray-500">
              ({total} {total === 1 ? "firma" : "firm"})
            </span>
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Firmy z enrollmentami tej kampanii bucketowane po statusie leadów
          </p>
        </div>
        <span className="text-gray-400">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
          {stages.map((st) => (
            <CampaignPipelineCard key={st.stage} bucket={st} />
          ))}
        </div>
      )}
    </section>
  );
}

function CampaignPipelineCard({
  bucket,
}: {
  bucket: CampaignPipelineStage;
}) {
  const empty = bucket.companies_count === 0;
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50/50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {bucket.name}
      </p>
      <p
        className={
          "mt-1 text-3xl font-bold " +
          (empty ? "text-gray-300" : "text-gray-900")
        }
      >
        {bucket.companies_count}
      </p>
      <p className="mt-0.5 text-xs text-gray-500">
        {empty ? (
          "—"
        ) : (
          <>
            Σ score{" "}
            <span className="font-mono text-gray-700">
              {bucket.total_score}
            </span>
          </>
        )}
      </p>
      {!empty && (
        <div className="mt-3 space-y-1 text-xs">
          <TierRow label="Tier 1" count={bucket.tier1} color="bg-emerald-500" />
          <TierRow label="Tier 2" count={bucket.tier2} color="bg-amber-500" />
          <TierRow label="Tier 3" count={bucket.tier3} color="bg-gray-400" />
        </div>
      )}
    </div>
  );
}

function TierRow({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  const muted = count === 0;
  return (
    <div className="flex items-center gap-2">
      <span
        className={
          "inline-block h-2 w-2 shrink-0 rounded-full " +
          (muted ? "bg-gray-200" : color)
        }
      />
      <span className={muted ? "text-gray-400" : "text-gray-700"}>
        {label}
      </span>
      <span
        className={
          "ml-auto font-mono " + (muted ? "text-gray-300" : "text-gray-900")
        }
      >
        {count}
      </span>
    </div>
  );
}

function AudienceBuilder({
  campaignId,
  lists,
  sources,
  onEnroll,
  onCancel,
}: {
  campaignId: number;
  lists: LeadList[];
  sources: SignalSummary[];
  onEnroll: (leadIds: number[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [includeListIds, setIncludeListIds] = useState<number[]>([]);
  const [excludeListIds, setExcludeListIds] = useState<number[]>([]);
  const [tiers, setTiers] = useState<number[]>([]);
  const [minStrength, setMinStrength] = useState<number | null>(null);
  const [sourceIds, setSourceIds] = useState<number[]>([]);
  const [titleQuery, setTitleQuery] = useState("");

  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleInSet<T>(set: T[], value: T): T[] {
    return set.includes(value)
      ? set.filter((x) => x !== value)
      : [...set, value];
  }

  async function handlePreview() {
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const criteria: AudienceCriteria = {
        include_list_ids: includeListIds.length ? includeListIds : undefined,
        exclude_list_ids: excludeListIds.length ? excludeListIds : undefined,
        tiers: tiers.length ? tiers : undefined,
        min_source_strength: minStrength,
        signal_source_ids: sourceIds.length ? sourceIds : undefined,
        signal_title_query: titleQuery.trim() || undefined,
      };
      const p = await api.campaigns.audiencePreview(campaignId, criteria);
      setPreview(p);
      // Default: select all non-enrolled
      setSelected(
        new Set(
          p.leads.filter((l) => !l.already_enrolled).map((l) => l.id),
        ),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd");
    } finally {
      setLoading(false);
    }
  }

  async function handleEnroll() {
    if (selected.size === 0) return;
    setEnrolling(true);
    try {
      await onEnroll(Array.from(selected));
    } finally {
      setEnrolling(false);
    }
  }

  function toggleSelect(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function selectAll() {
    if (!preview) return;
    setSelected(
      new Set(
        preview.leads.filter((l) => !l.already_enrolled).map((l) => l.id),
      ),
    );
  }

  function selectNone() {
    setSelected(new Set());
  }

  return (
    <div className="space-y-4 rounded-lg border-2 border-gray-900 bg-white p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">
          Audience builder
        </h4>
        <button
          onClick={onCancel}
          className="text-xs text-gray-500 hover:text-gray-900"
        >
          ✕ Zamknij
        </button>
      </div>

      {/* Include lists */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-gray-500">
          Włącz listy
        </p>
        {lists.length === 0 ? (
          <p className="text-xs text-gray-400">Brak list</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {lists.map((l) => {
              const on = includeListIds.includes(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() =>
                    setIncludeListIds(toggleInSet(includeListIds, l.id))
                  }
                  className={
                    "rounded-full px-3 py-1 text-xs border transition " +
                    (on
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-700 border-gray-300 hover:border-gray-500")
                  }
                >
                  {l.name} ({l.leads_count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Exclude lists */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-gray-500">
          Wyklucz listy
        </p>
        {lists.length === 0 ? (
          <p className="text-xs text-gray-400">—</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {lists.map((l) => {
              const on = excludeListIds.includes(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() =>
                    setExcludeListIds(toggleInSet(excludeListIds, l.id))
                  }
                  className={
                    "rounded-full px-3 py-1 text-xs border transition " +
                    (on
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-white text-gray-700 border-gray-300 hover:border-gray-500")
                  }
                >
                  {l.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tier */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-gray-500">
          Tier (puste = wszystkie)
        </p>
        <div className="flex gap-2">
          {[1, 2, 3].map((t) => {
            const on = tiers.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTiers(toggleInSet(tiers, t))}
                className={
                  "rounded-full px-3 py-1 text-xs border transition " +
                  (on
                    ? t === 1
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : t === 2
                        ? "bg-amber-600 text-white border-amber-600"
                        : "bg-gray-600 text-white border-gray-600"
                    : "bg-white text-gray-700 border-gray-300 hover:border-gray-500")
                }
              >
                Tier {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Min source strength */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-gray-500">
          Min. siła sygnału (źródła)
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMinStrength(null)}
            className={
              "rounded-full px-3 py-1 text-xs border transition " +
              (minStrength === null
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-700 border-gray-300")
            }
          >
            dowolna
          </button>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setMinStrength(n)}
              className={
                "rounded-full px-3 py-1 text-xs border transition " +
                (minStrength === n
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-700 border-gray-300 hover:border-gray-500")
              }
            >
              ≥ {n}
            </button>
          ))}
        </div>
      </div>

      {/* Signal sources */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-gray-500">
          Konkretne źródła sygnałów
        </p>
        {sources.length === 0 ? (
          <p className="text-xs text-gray-400">Brak źródeł</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sources.map((s) => {
              const on = sourceIds.includes(s.source_id);
              return (
                <button
                  key={s.source_id}
                  type="button"
                  onClick={() =>
                    setSourceIds(toggleInSet(sourceIds, s.source_id))
                  }
                  className={
                    "rounded-full px-3 py-1 text-xs border transition " +
                    (on
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-700 border-gray-300 hover:border-gray-500")
                  }
                  title={`${s.signals_count} detekcji · ${s.unique_companies} firm`}
                >
                  {s.source_name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Title query */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase text-gray-500">
          Fraza w tytule sygnału
        </p>
        <input
          type="search"
          value={titleQuery}
          onChange={(e) => setTitleQuery(e.target.value)}
          placeholder="np. HR Manager, Pracownik produkcji"
          className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 border-t border-gray-200 pt-3">
        <button
          type="button"
          onClick={handlePreview}
          disabled={loading}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Szukam..." : "Pokaż pasujących"}
        </button>
        {error && (
          <p className="rounded-md bg-red-50 px-3 py-1.5 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      {/* Preview */}
      {preview && (
        <div className="space-y-2 border-t border-gray-200 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-gray-600">
              {preview.matched_total} pasuje · {preview.already_enrolled_count}{" "}
              już zenrollowanych · {selected.size} zaznaczonych
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-gray-600 hover:text-gray-900 underline"
              >
                Zaznacz wszystkich
              </button>
              <button
                type="button"
                onClick={selectNone}
                className="text-xs text-gray-600 hover:text-gray-900 underline"
              >
                Odznacz wszystkich
              </button>
            </div>
          </div>

          {preview.leads.length === 0 ? (
            <p className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
              Nic nie pasuje do filtrów.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-md border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr>
                    <th className="w-8 px-2 py-1.5"></th>
                    <th className="px-2 py-1.5 text-left font-medium text-gray-700">
                      Lead
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium text-gray-700">
                      Firma
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium text-gray-700">
                      Lista
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium text-gray-700">
                      Tier
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium text-gray-700">
                      Sig
                    </th>
                    <th className="px-2 py-1.5 text-right font-medium text-gray-700">
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {preview.leads.map((l: AudienceLead) => (
                    <tr
                      key={l.id}
                      className={l.already_enrolled ? "opacity-50" : ""}
                    >
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          disabled={l.already_enrolled}
                          checked={selected.has(l.id)}
                          onChange={() => toggleSelect(l.id)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="text-gray-900">{l.email}</div>
                        {(l.first_name || l.last_name) && (
                          <div className="text-xs text-gray-500">
                            {[l.first_name, l.last_name]
                              .filter(Boolean)
                              .join(" ")}
                          </div>
                        )}
                        {l.already_enrolled && (
                          <div className="text-xs text-amber-600">
                            ✓ już w kampanii
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-gray-700">
                        {l.company || "—"}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-gray-600">
                        {l.list_name}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                          T{l.tier}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-700">
                        {l.signals_count}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        {l.score}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            type="button"
            onClick={handleEnroll}
            disabled={enrolling || selected.size === 0}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {enrolling
              ? "Zapisuję..."
              : `Zapisz zaznaczonych (${selected.size})`}
          </button>
        </div>
      )}
    </div>
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
