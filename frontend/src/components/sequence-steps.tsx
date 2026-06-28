"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Briefcase,
  CheckSquare,
  ChevronDown,
  Eye,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import {
  api,
  ApiError,
  Campaign,
  SequenceStep,
  StepChannel,
  StepStats,
  StepVariant,
  VariantStats,
} from "@/lib/api-client";

const CHANNELS: {
  key: StepChannel;
  label: string;
  icon: typeof Mail;
  color: string;
  manual: boolean;
}[] = [
  { key: "email", label: "Email", icon: Mail, color: "text-blue-600", manual: false },
  { key: "linkedin_invite", label: "LinkedIn — zaproszenie", icon: Briefcase, color: "text-sky-600", manual: true },
  { key: "linkedin_message", label: "LinkedIn — wiadomość", icon: Briefcase, color: "text-sky-600", manual: true },
  { key: "linkedin_visit", label: "LinkedIn — wizyta profilu", icon: Briefcase, color: "text-sky-600", manual: true },
  { key: "call", label: "Telefon", icon: Phone, color: "text-emerald-600", manual: true },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "text-green-600", manual: true },
  { key: "task", label: "Zadanie", icon: CheckSquare, color: "text-amber-600", manual: true },
];

function channelMeta(c: StepChannel) {
  return CHANNELS.find((x) => x.key === c) ?? CHANNELS[0];
}

const SPAM_WORDS = [
  "free", "darmowy", "gwarancja", "kliknij tutaj", "kup teraz", "promocja",
  "oferta specjalna", "100%", "zarobek", "wygraj", "pilne", "$$$", "okazja",
];

function renderSample(t: string): string {
  return t
    .replace(/\{spin\s+(.*?)\s+endspin\}/gis, (_m, g: string) =>
      (g.split("|")[0] || "").trim(),
    )
    .replace(/\{\{\s*first_name\s*\}\}/g, "Jan")
    .replace(/\{\{\s*last_name\s*\}\}/g, "Kowalski")
    .replace(/\{\{\s*company\s*\}\}/g, "Przykładowa firma")
    .replace(/\{\{\s*title\s*\}\}/g, "Dyrektor HR")
    .replace(/\{\{\s*email\s*\}\}/g, "jan@przyklad.pl");
}

// ---------- StepsTab ----------

export function StepsTab({
  campaignId,
  campaign,
  steps,
  statsByStepId,
  refresh,
}: {
  campaignId: number;
  campaign: Campaign;
  steps: SequenceStep[];
  statsByStepId: Map<number, StepStats>;
  refresh: () => Promise<void>;
}) {
  // editing: a step object, or "new" with chosen channel, or null (closed)
  const [editing, setEditing] = useState<SequenceStep | null>(null);
  const [creating, setCreating] = useState<StepChannel | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="space-y-3">
      {steps.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">
            Pusta sekwencja. Dodaj pierwszy krok, aby zacząć.
          </p>
        </div>
      )}

      {steps.map((step, i) => {
        const day =
          1 + steps.slice(1, i + 1).reduce((a, s) => a + s.delay_days, 0);
        return (
          <StepCard
            key={step.id}
            step={step}
            index={i}
            day={day}
            stats={statsByStepId.get(step.id) ?? null}
            campaignId={campaignId}
            onEdit={() => setEditing(step)}
            onChanged={refresh}
          />
        );
      })}

      {/* Add step */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" /> Dodaj krok
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </button>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute z-20 mt-1 w-60 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {CHANNELS.map(({ key, label, icon: Icon, color }) => (
                <button
                  key={key}
                  onClick={() => {
                    setCreating(key);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Icon className={`h-4 w-4 ${color}`} />
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {(editing || creating) && (
        <StepComposer
          campaignId={campaignId}
          campaign={campaign}
          step={editing}
          newChannel={creating}
          nextOrder={steps.length}
          onClose={() => {
            setEditing(null);
            setCreating(null);
          }}
          onSaved={async () => {
            await refresh();
            setEditing(null);
            setCreating(null);
          }}
        />
      )}
    </div>
  );
}

// ---------- Step card ----------

function StepCard({
  step,
  index,
  day,
  stats,
  campaignId,
  onEdit,
  onChanged,
}: {
  step: SequenceStep;
  index: number;
  day: number;
  stats: StepStats | null;
  campaignId: number;
  onEdit: () => void;
  onChanged: () => Promise<void>;
}) {
  const meta = channelMeta(step.channel);
  const Icon = meta.icon;
  const [genLoading, setGenLoading] = useState(false);
  const [variantCount, setVariantCount] = useState<number | null>(null);

  useEffect(() => {
    api.campaigns
      .listVariants(campaignId, step.id)
      .then((v) => setVariantCount(v.length))
      .catch(() => setVariantCount(null));
  }, [campaignId, step.id]);

  async function genAi() {
    setGenLoading(true);
    try {
      await api.campaigns.generateAiVariant(campaignId, step.id);
      await onChanged();
    } catch (e) {
      alert(e instanceof ApiError ? e.detail : "Błąd generowania wariantu");
    } finally {
      setGenLoading(false);
    }
  }

  return (
    <div className="flex gap-3">
      {/* Day rail */}
      <div className="flex w-16 shrink-0 flex-col items-center">
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
          Dzień {day}
        </span>
        <div className="mt-1 w-px flex-1 bg-gray-200" />
      </div>

      {/* Card */}
      <div className="flex-1 rounded-xl border border-gray-200 bg-white shadow-sm">
        <button
          onClick={onEdit}
          className="block w-full p-4 text-left hover:bg-gray-50/60"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100">
              <Icon className={`h-4.5 w-4.5 ${meta.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Krok {index + 1}
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
                  {meta.label}
                </span>
                {meta.manual && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                    zadanie ręczne
                  </span>
                )}
              </div>
              <p className="mt-1.5 truncate text-sm font-semibold text-gray-900">
                {step.subject || "(bez tematu)"}
              </p>
              <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-gray-500">
                {step.body_template || "(pusta treść)"}
              </p>
            </div>
            {/* Stats */}
            <div className="hidden shrink-0 gap-5 pl-2 text-center sm:flex">
              <Stat label="Wysłane" value={stats?.sent_count ?? 0} />
              <Stat label="Otwarcia" value={stats?.opened_count ?? 0} />
              <Stat label="Kliknięcia" value={stats?.clicked_count ?? 0} />
              <Stat label="Błędy" value={stats?.failed_count ?? 0} muted />
            </div>
          </div>
        </button>

        {/* Footer actions */}
        {step.channel === "email" && (
          <div className="flex items-center gap-4 border-t border-gray-100 px-4 py-2">
            <button
              onClick={genAi}
              disabled={genLoading}
              className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-700 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {genLoading ? "Generuję…" : "Generuj wariant AI"}
            </button>
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900"
            >
              <FileText className="h-3.5 w-3.5" /> Edytuj treść / warianty
            </button>
            {variantCount != null && variantCount > 0 && (
              <span className="ml-auto rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                {variantCount + 1} warianty A/B
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: number;
  muted?: boolean;
}) {
  return (
    <div>
      <p
        className={
          "text-lg font-bold " +
          (muted && value === 0 ? "text-gray-300" : "text-gray-900")
        }
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-gray-400">
        {label}
      </p>
    </div>
  );
}

// ---------- Composer modal ----------

function StepComposer({
  campaignId,
  campaign,
  step,
  newChannel,
  nextOrder,
  onClose,
  onSaved,
}: {
  campaignId: number;
  campaign: Campaign;
  step: SequenceStep | null;
  newChannel: StepChannel | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const channel: StepChannel = step?.channel ?? newChannel ?? "email";
  const isEmail = channel === "email";
  const meta = channelMeta(channel);

  const [subject, setSubject] = useState(step?.subject ?? "");
  const [body, setBody] = useState(step?.body_template ?? "");
  const [delay, setDelay] = useState(step?.delay_days ?? (step ? 0 : nextOrder === 0 ? 0 : 3));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [right, setRight] = useState<"guide" | "preview">("guide");

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const focusedRef = useRef<"subject" | "body">("body");

  function insert(text: string) {
    if (focusedRef.current === "subject" && subjectRef.current) {
      const el = subjectRef.current;
      const s = el.selectionStart ?? subject.length;
      const e = el.selectionEnd ?? subject.length;
      setSubject(subject.slice(0, s) + text + subject.slice(e));
    } else if (bodyRef.current) {
      const el = bodyRef.current;
      const s = el.selectionStart ?? body.length;
      const e = el.selectionEnd ?? body.length;
      setBody(body.slice(0, s) + text + body.slice(e));
    }
  }

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      if (step) {
        await api.campaigns.updateStep(campaignId, step.id, {
          subject,
          body_template: body,
          delay_days: delay,
          channel,
        });
      } else {
        await api.campaigns.createStep(campaignId, {
          step_order: nextOrder,
          subject: subject || meta.label,
          body_template: body || "(uzupełnij treść)",
          delay_days: delay,
          channel,
        });
      }
      await onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.detail : "Błąd zapisu");
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!step) return;
    if (!window.confirm("Usunąć ten krok?")) return;
    try {
      await api.campaigns.deleteStep(campaignId, step.id);
      await onSaved();
    } catch (e) {
      alert(e instanceof ApiError ? e.detail : "Błąd");
    }
  }

  const a = analyze(subject, body);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <meta.icon className={`h-4 w-4 ${meta.color}`} />
            <span className="font-semibold text-gray-900">
              {step ? `Krok ${step.step_order + 1}` : "Nowy krok"} · {meta.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Editor */}
          <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600">Wyślij po (dni):</label>
              <input
                type="number"
                min={0}
                max={365}
                value={delay}
                onChange={(e) => setDelay(Number(e.target.value))}
                className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
              <span className="text-xs text-gray-400">
                od poprzedniego kroku
              </span>
            </div>

            {isEmail && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Temat
                </label>
                <input
                  ref={subjectRef}
                  onFocus={() => (focusedRef.current = "subject")}
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Szybkie pytanie, {{first_name}}"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>
            )}

            {/* Insert toolbar */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] uppercase text-gray-400">Wstaw:</span>
              {["first_name", "company", "title"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => insert(`{{${t}}}`)}
                  className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-600 hover:bg-gray-900 hover:text-white"
                >
                  {`{{${t}}}`}
                </button>
              ))}
              <button
                type="button"
                onClick={() => insert("{spin Cześć|Hej|Dzień dobry endspin}")}
                className="rounded-md bg-violet-100 px-2 py-0.5 font-mono text-[11px] text-violet-700 hover:bg-violet-600 hover:text-white"
              >
                spintax
              </button>
            </div>

            <textarea
              ref={bodyRef}
              onFocus={() => (focusedRef.current = "body")}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={isEmail ? 12 : 8}
              placeholder={
                isEmail
                  ? "Treść maila…\n\nUżyj {{first_name}}, {{company}}, merge-tagów z Profilu klienta ({{persona_1_pain_1}}) i spintaxu."
                  : "Treść / notatka do wykonania ręcznego (LinkedIn, telefon, zadanie)…"
              }
              className="block w-full flex-1 rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />

            {err && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </p>
            )}

            {isEmail && step && (
              <VariantsArea campaignId={campaignId} stepId={step.id} />
            )}
          </div>

          {/* Right panel */}
          <div className="hidden w-80 shrink-0 flex-col border-l border-gray-200 bg-gray-50 lg:flex">
            <div className="flex border-b border-gray-200 bg-white">
              <RightTab
                active={right === "guide"}
                onClick={() => setRight("guide")}
                icon={FileText}
                label="Content Guide"
              />
              <RightTab
                active={right === "preview"}
                onClick={() => setRight("preview")}
                icon={Eye}
                label="Podgląd"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {right === "guide" ? (
                <ContentGuide a={a} isEmail={isEmail} />
              ) : (
                <EmailPreview
                  campaign={campaign}
                  subject={subject}
                  body={body}
                  stepId={step?.id ?? null}
                  campaignId={campaignId}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
          <div>
            {step && (
              <button
                onClick={del}
                className="inline-flex items-center gap-1 text-sm text-red-600 hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" /> Usuń krok
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-100"
            >
              Anuluj
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? "Zapisuję…" : "Zapisz krok"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RightTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof FileText;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-xs font-medium " +
        (active
          ? "border-gray-900 text-gray-900"
          : "border-transparent text-gray-500 hover:text-gray-900")
      }
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

// ---------- Content Guide ----------

function analyze(subject: string, body: string) {
  const text = `${subject} ${body}`.toLowerCase();
  return {
    subjLen: subject.length,
    words: body.trim() ? body.trim().split(/\s+/).length : 0,
    personalization: (subject + body).match(/\{\{[^}]+\}\}/g)?.length ?? 0,
    links: body.match(/https?:\/\/\S+/g)?.length ?? 0,
    spam: SPAM_WORDS.filter((w) => text.includes(w)).length,
  };
}

function GuideRow({
  label,
  value,
  rating,
  good,
  hint,
}: {
  label: string;
  value: string;
  rating: string;
  good: "good" | "warn" | "bad";
  hint: string;
}) {
  const color =
    good === "good"
      ? "text-emerald-600"
      : good === "warn"
        ? "text-amber-500"
        : "text-rose-500";
  const bar =
    good === "good"
      ? "bg-emerald-500"
      : good === "warn"
        ? "bg-amber-400"
        : "bg-rose-400";
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-700">{label}</span>
        <span className="text-sm font-semibold text-gray-900">{value}</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full ${bar}`} style={{ width: "100%" }} />
      </div>
      <div className="mt-0.5 flex items-center justify-between">
        <span className="text-[11px] text-gray-400">{hint}</span>
        <span className={`text-[11px] font-medium ${color}`}>{rating}</span>
      </div>
    </div>
  );
}

function ContentGuide({
  a,
  isEmail,
}: {
  a: ReturnType<typeof analyze>;
  isEmail: boolean;
}) {
  if (!isEmail) {
    return (
      <p className="text-sm text-gray-500">
        Content Guide dotyczy kroków e-mail. Ten krok jest zadaniem ręcznym.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <GuideRow
        label="Długość tematu"
        value={`${a.subjLen} zn.`}
        hint="Sugerowane 30-60"
        rating={a.subjLen < 30 ? "Za krótki" : a.subjLen > 60 ? "Za długi" : "Idealny"}
        good={a.subjLen >= 30 && a.subjLen <= 60 ? "good" : "warn"}
      />
      <GuideRow
        label="Liczba słów"
        value={`${a.words}`}
        hint="Sugerowane 50-200"
        rating={a.words < 50 ? "Za mało" : a.words > 200 ? "Za dużo" : "Idealnie"}
        good={a.words >= 50 && a.words <= 200 ? "good" : "warn"}
      />
      <GuideRow
        label="Personalizacja"
        value={`${a.personalization} tagów`}
        hint="2+ merge-tagów"
        rating={a.personalization >= 2 ? "Dobrze" : "Dodaj więcej"}
        good={a.personalization >= 2 ? "good" : "warn"}
      />
      <GuideRow
        label="Linki"
        value={`${a.links}`}
        hint="Minimalnie"
        rating={a.links <= 1 ? "Świetnie" : "Za dużo"}
        good={a.links <= 1 ? "good" : "warn"}
      />
      <GuideRow
        label="Spam"
        value={`${a.spam} słów`}
        hint="Unikaj spam-słów"
        rating={a.spam === 0 ? "Świetnie" : "Uważaj"}
        good={a.spam === 0 ? "good" : "bad"}
      />
    </div>
  );
}

// ---------- Email preview ----------

function EmailPreview({
  campaign,
  subject,
  body,
  stepId,
  campaignId,
}: {
  campaign: Campaign;
  subject: string;
  body: string;
  stepId: number | null;
  campaignId: number;
}) {
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sendTest() {
    if (stepId == null) {
      setMsg("Najpierw zapisz krok, aby wysłać test.");
      return;
    }
    setTesting(true);
    setMsg(null);
    try {
      const r = await api.campaigns.testSendStep(campaignId, stepId);
      setMsg(`Wysłano test na ${r.sent_to}.`);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.detail : "Błąd wysyłki testu");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
        <p className="text-xs text-gray-400">Od</p>
        <p className="text-gray-800">
          {campaign.from_name
            ? `${campaign.from_name} <${campaign.from_email}>`
            : campaign.from_email}
        </p>
        <p className="mt-2 text-xs text-gray-400">Do</p>
        <p className="text-gray-800">Jan Kowalski &lt;jan@przyklad.pl&gt;</p>
        <p className="mt-2 text-xs text-gray-400">Temat</p>
        <p className="font-semibold text-gray-900">
          {renderSample(subject) || "(bez tematu)"}
        </p>
        <hr className="my-2 border-gray-100" />
        <p className="whitespace-pre-wrap text-gray-800">
          {renderSample(body) || "(pusta treść)"}
        </p>
      </div>
      <button
        onClick={sendTest}
        disabled={testing}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
      >
        <Send className="h-3.5 w-3.5" />
        {testing ? "Wysyłam…" : "Wyślij testowy mail"}
      </button>
      {msg && <p className="text-xs text-gray-600">{msg}</p>}
      <p className="text-[11px] text-gray-400">
        Podgląd na przykładowych danych. Spintax pokazuje pierwszą opcję; przy
        realnej wysyłce każdy odbiorca dostaje swój wariant.
      </p>
    </div>
  );
}

// ---------- Variants (inside composer) ----------

function VariantsArea({
  campaignId,
  stepId,
}: {
  campaignId: number;
  stepId: number;
}) {
  const [variants, setVariants] = useState<StepVariant[]>([]);
  const [stats, setStats] = useState<VariantStats | null>(null);
  const [gen, setGen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [vs, setVs] = useState("");
  const [vb, setVb] = useState("");

  async function refresh() {
    try {
      const [v, s] = await Promise.all([
        api.campaigns.listVariants(campaignId, stepId),
        api.campaigns.variantStats(campaignId, stepId).catch(() => null),
      ]);
      setVariants(v);
      setStats(s);
    } catch {
      // ignore
    }
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId]);

  async function toggleAuto() {
    if (!stats) return;
    try {
      await api.campaigns.updateStep(campaignId, stepId, {
        ab_auto: !stats.ab_auto,
      });
      await refresh();
    } catch (e) {
      alert(e instanceof ApiError ? e.detail : "Błąd");
    }
  }

  async function genAi() {
    setGen(true);
    try {
      await api.campaigns.generateAiVariant(campaignId, stepId);
      await refresh();
    } catch (e) {
      alert(e instanceof ApiError ? e.detail : "Błąd");
    } finally {
      setGen(false);
    }
  }
  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await api.campaigns.createVariant(campaignId, stepId, {
        subject: vs,
        body_template: vb,
      });
      setVs("");
      setVb("");
      setShowForm(false);
      await refresh();
    } catch (e) {
      alert(e instanceof ApiError ? e.detail : "Błąd");
    }
  }
  async function del(id: number) {
    await api.campaigns.deleteVariant(campaignId, stepId, id);
    await refresh();
  }

  return (
    <div className="rounded-lg border border-violet-100 bg-violet-50/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-violet-700">
          Warianty A/B
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={genAi}
            disabled={gen}
            className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            <Sparkles className="h-3 w-3" /> {gen ? "Generuję…" : "Generuj AI"}
          </button>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md border border-violet-200 bg-white px-2.5 py-1 text-xs text-violet-700 hover:bg-violet-100"
          >
            + Ręcznie
          </button>
        </div>
      </div>

      {/* Auto-winner toggle + performance */}
      {stats && stats.variants.length > 1 && (
        <div className="mt-2 rounded-md border border-violet-100 bg-white p-2">
          <label className="flex cursor-pointer items-center justify-between gap-2">
            <span className="text-[11px] text-gray-700">
              Auto-wybór zwycięzcy{" "}
              <span className="text-gray-400">
                (po {stats.min_sample} wysyłkach/wariant wybiera najlepszy open
                rate)
              </span>
            </span>
            <button
              type="button"
              onClick={toggleAuto}
              className={
                "relative h-4 w-7 shrink-0 rounded-full transition " +
                (stats.ab_auto ? "bg-violet-600" : "bg-gray-300")
              }
            >
              <span
                className={
                  "absolute top-0.5 h-3 w-3 rounded-full bg-white transition " +
                  (stats.ab_auto ? "left-3.5" : "left-0.5")
                }
              />
            </button>
          </label>
          <div className="mt-2 space-y-1">
            {stats.variants.map((v) => {
              const win = stats.winner_variant_id === v.variant_id;
              return (
                <div
                  key={v.label}
                  className="flex items-center gap-2 text-[11px]"
                >
                  <span className="w-4 font-semibold text-gray-700">
                    {v.label}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={win ? "h-full bg-emerald-500" : "h-full bg-violet-400"}
                      style={{ width: `${Math.min(100, v.open_rate)}%` }}
                    />
                  </div>
                  <span className="w-24 text-right text-gray-500">
                    {v.open_rate}% open · {v.sent} wys.
                  </span>
                  {win && (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                      Zwycięzca
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {showForm && (
        <form onSubmit={add} className="mt-2 space-y-2">
          <input
            value={vs}
            onChange={(e) => setVs(e.target.value)}
            required
            placeholder="Temat wariantu"
            className="block w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
          />
          <textarea
            value={vb}
            onChange={(e) => setVb(e.target.value)}
            required
            rows={3}
            placeholder="Treść wariantu"
            className="block w-full rounded-md border border-gray-300 px-2 py-1 font-mono text-xs"
          />
          <button className="rounded-md bg-gray-900 px-3 py-1 text-xs font-medium text-white">
            Zapisz wariant
          </button>
        </form>
      )}
      {variants.length === 0 ? (
        <p className="mt-2 text-[11px] text-violet-700/70">
          Tylko wariant A (treść powyżej). Dodaj B/C dla testu A/B.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {variants.map((v, i) => (
            <li
              key={v.id}
              className="flex items-start justify-between gap-2 rounded-md bg-white px-2 py-1.5"
            >
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-gray-500">
                  Wariant {String.fromCharCode(66 + i)}
                </p>
                <p className="truncate text-xs font-medium text-gray-900">
                  {v.subject}
                </p>
              </div>
              <button
                type="button"
                onClick={() => del(v.id)}
                className="text-[11px] text-red-600 hover:underline"
              >
                Usuń
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
