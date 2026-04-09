"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import {
  api,
  ApiError,
  Campaign,
  CampaignStatus,
  Enrollment,
  LeadList,
  PreviewResponse,
  SequenceStep,
} from "@/lib/api-client";

const STATUS_OPTIONS: CampaignStatus[] = [
  "draft",
  "active",
  "paused",
  "archived",
];

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const campaignId = Number(params.id);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [lists, setLists] = useState<LeadList[]>([]);
  const [loading, setLoading] = useState(true);

  // Campaign metadata edit
  const [name, setName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatus>("draft");
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  // New step form
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newDelay, setNewDelay] = useState(0);
  const [addingStep, setAddingStep] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  // Enroll
  const [enrollListId, setEnrollListId] = useState<number | "">("");
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState<string | null>(null);

  // Send due now
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);

  // Preview
  const [previewStepId, setPreviewStepId] = useState<number | "">("");
  const [previewLeadId, setPreviewLeadId] = useState<number | "">("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [c, s, e, l] = await Promise.all([
        api.campaigns.get(campaignId),
        api.campaigns.listSteps(campaignId),
        api.campaigns.listEnrollments(campaignId),
        api.lists.list(),
      ]);
      setCampaign(c);
      setSteps(s);
      setEnrollments(e);
      setLists(l);
      setName(c.name);
      setFromEmail(c.from_email);
      setFromName(c.from_name ?? "");
      setCampaignStatus(c.status);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        router.replace("/campaigns");
        return;
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  async function handleSaveMeta(e: FormEvent) {
    e.preventDefault();
    setMetaError(null);
    setSavingMeta(true);
    try {
      await api.campaigns.update(campaignId, {
        name,
        from_email: fromEmail,
        from_name: fromName || undefined,
        status: campaignStatus,
      });
      await refresh();
    } catch (err) {
      setMetaError(err instanceof ApiError ? err.detail : "Błąd zapisu");
    } finally {
      setSavingMeta(false);
    }
  }

  async function handleAddStep(e: FormEvent) {
    e.preventDefault();
    setStepError(null);
    setAddingStep(true);
    try {
      await api.campaigns.createStep(campaignId, {
        step_order: steps.length,
        subject: newSubject,
        body_template: newBody,
        delay_days: newDelay,
      });
      setNewSubject("");
      setNewBody("");
      setNewDelay(0);
      await refresh();
    } catch (err) {
      setStepError(err instanceof ApiError ? err.detail : "Błąd dodawania");
    } finally {
      setAddingStep(false);
    }
  }

  async function handleDeleteStep(stepId: number) {
    if (!window.confirm("Usunąć ten step?")) return;
    try {
      await api.campaigns.deleteStep(campaignId, stepId);
      await refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Błąd");
    }
  }

  async function handleEnroll(e: FormEvent) {
    e.preventDefault();
    if (enrollListId === "") return;
    setEnrolling(true);
    setEnrollMsg(null);
    try {
      const result = await api.campaigns.enrollFromList(
        campaignId,
        Number(enrollListId),
      );
      setEnrollMsg(
        `Zapisano: ${result.enrolled}, pominięto duplikaty: ${result.skipped_already_enrolled}`,
      );
      await refresh();
    } catch (err) {
      setEnrollMsg(err instanceof ApiError ? `Błąd: ${err.detail}` : "Błąd");
    } finally {
      setEnrolling(false);
    }
  }

  async function handleUnenroll(enrollmentId: number) {
    try {
      await api.campaigns.unenroll(campaignId, enrollmentId);
      await refresh();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Błąd");
    }
  }

  async function handleSendDueNow() {
    setSending(true);
    setSendMsg(null);
    try {
      const result = await api.campaigns.sendDueNow(campaignId);
      setSendMsg(
        result.processed > 0
          ? `Wysłano ${result.processed} maili. Sprawdź Mailhog: http://localhost:8025`
          : "Brak enrollmentów gotowych do wysyłki (next_send_at > now())",
      );
      await refresh();
    } catch (err) {
      setSendMsg(err instanceof ApiError ? `Błąd: ${err.detail}` : "Błąd");
    } finally {
      setSending(false);
    }
  }

  async function handlePreview(e: FormEvent) {
    e.preventDefault();
    if (previewStepId === "" || previewLeadId === "") return;
    setPreviewError(null);
    setPreview(null);
    try {
      const p = await api.campaigns.preview(
        campaignId,
        Number(previewStepId),
        Number(previewLeadId),
      );
      setPreview(p);
    } catch (err) {
      setPreviewError(
        err instanceof ApiError ? err.detail : "Błąd renderu preview",
      );
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Ładowanie...</p>;
  if (!campaign) return null;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/campaigns"
          className="text-sm text-gray-500 hover:underline"
        >
          ← Wszystkie kampanie
        </Link>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">
          {campaign.name}
        </h2>
        <p className="mt-1 text-sm text-gray-400">
          {steps.length} {steps.length === 1 ? "step" : "stepów"} •{" "}
          {enrollments.length}{" "}
          {enrollments.length === 1 ? "enrollment" : "enrollmentów"}
        </p>
      </div>

      {/* Campaign metadata */}
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-medium text-gray-700">
          Ustawienia kampanii
        </h3>
        <form onSubmit={handleSaveMeta} className="space-y-3">
          <input
            type="text"
            required
            placeholder="Nazwa"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              type="email"
              required
              placeholder="from email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="from name"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <select
            value={campaignStatus}
            onChange={(e) =>
              setCampaignStatus(e.target.value as CampaignStatus)
            }
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {metaError && (
            <p className="text-sm text-red-600">{metaError}</p>
          )}
          <button
            disabled={savingMeta}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {savingMeta ? "Zapisywanie..." : "Zapisz zmiany"}
          </button>
        </form>
      </section>

      {/* Steps */}
      <section className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700">Sekwencja stepów</h3>

        {steps.length === 0 ? (
          <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
            Brak stepów. Dodaj pierwszy poniżej.
          </p>
        ) : (
          <div className="space-y-3">
            {steps.map((s) => (
              <StepCard
                key={s.id}
                step={s}
                campaignId={campaignId}
                onChanged={refresh}
                onDelete={() => handleDeleteStep(s.id)}
              />
            ))}
          </div>
        )}

        {/* Add step form */}
        <form
          onSubmit={handleAddStep}
          className="space-y-3 rounded-lg border border-dashed border-gray-300 bg-white p-4"
        >
          <h4 className="text-sm font-medium text-gray-700">
            Dodaj step #{steps.length}
          </h4>
          <input
            type="text"
            required
            placeholder="Subject (np. Quick question, {{first_name}})"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
          />
          <textarea
            required
            placeholder="Body — używaj {{first_name}}, {{last_name}}, {{company}}, {{title}}, {{email}}"
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            rows={6}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
          />
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700">Delay (dni):</label>
            <input
              type="number"
              min={0}
              max={365}
              value={newDelay}
              onChange={(e) => setNewDelay(Number(e.target.value))}
              className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <span className="text-xs text-gray-500">
              {steps.length === 0
                ? "od enrollmentu"
                : "od poprzedniego stepa"}
            </span>
          </div>
          {stepError && <p className="text-sm text-red-600">{stepError}</p>}
          <button
            disabled={addingStep}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {addingStep ? "Dodawanie..." : "Dodaj step"}
          </button>
        </form>
      </section>

      {/* Enrollment */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">
            Enrollment leadów
          </h3>
          <button
            onClick={handleSendDueNow}
            disabled={sending || enrollments.length === 0}
            className="rounded-md border border-gray-900 bg-white px-3 py-1 text-xs font-medium text-gray-900 hover:bg-gray-100 disabled:opacity-50"
            title="Wymuś wysyłkę wszystkich enrollmentów z next_send_at <= now() (zwykle worker robi to co minutę)"
          >
            {sending ? "Wysyłanie..." : "Wyślij due teraz"}
          </button>
        </div>
        {sendMsg && (
          <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
            {sendMsg}
          </p>
        )}

        <form
          onSubmit={handleEnroll}
          className="flex items-end gap-3 rounded-lg border border-gray-200 bg-white p-4"
        >
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700">
              Wybierz listę
            </label>
            <select
              value={enrollListId}
              onChange={(e) =>
                setEnrollListId(
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">— wybierz —</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.leads_count} leadów)
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={enrollListId === "" || enrolling}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {enrolling ? "Zapisuję..." : "Zapisz wszystkich"}
          </button>
        </form>
        {enrollMsg && (
          <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
            {enrollMsg}
          </p>
        )}

        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          {enrollments.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">Brak enrollmentów.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Lead
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Firma
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Status
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-gray-700">
                    Step
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700">
                    Następna wysyłka
                  </th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {enrollments.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="text-gray-900">{e.lead_email}</div>
                      {e.lead_name && (
                        <div className="text-xs text-gray-500">
                          {e.lead_name}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {e.lead_company || "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-gray-900">
                      {e.current_step}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-600">
                      {e.next_send_at
                        ? new Date(e.next_send_at).toLocaleString("pl-PL")
                        : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
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
          )}
        </div>
      </section>

      {/* Preview */}
      {steps.length > 0 && enrollments.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">
            Preview szablonu
          </h3>
          <form
            onSubmit={handlePreview}
            className="flex items-end gap-3 rounded-lg border border-gray-200 bg-white p-4"
          >
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700">
                Step
              </label>
              <select
                value={previewStepId}
                onChange={(e) =>
                  setPreviewStepId(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">— wybierz step —</option>
                {steps.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{s.step_order}] {s.subject}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700">
                Lead
              </label>
              <select
                value={previewLeadId}
                onChange={(e) =>
                  setPreviewLeadId(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">— wybierz lead —</option>
                {enrollments.map((e) => (
                  <option key={e.lead_id} value={e.lead_id}>
                    {e.lead_email}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={previewStepId === "" || previewLeadId === ""}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              Renderuj
            </button>
          </form>

          {previewError && (
            <p className="text-sm text-red-600">{previewError}</p>
          )}

          {preview && (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500">SUBJECT</p>
              <p className="mt-1 font-medium text-gray-900">
                {preview.subject}
              </p>
              <p className="mt-3 text-xs font-medium text-gray-500">BODY</p>
              <pre className="mt-1 whitespace-pre-wrap font-mono text-sm text-gray-900">
                {preview.body}
              </pre>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ---------- Step card component ----------

function StepCard({
  step,
  campaignId,
  onChanged,
  onDelete,
}: {
  step: SequenceStep;
  campaignId: number;
  onChanged: () => Promise<void>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(step.subject);
  const [body, setBody] = useState(step.body_template);
  const [delay, setDelay] = useState(step.delay_days);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.campaigns.updateStep(campaignId, step.id, {
        subject,
        body_template: body,
        delay_days: delay,
      });
      setEditing(false);
      await onChanged();
    } catch (err) {
      alert(err instanceof ApiError ? err.detail : "Błąd");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-gray-500">
            STEP #{step.step_order}
          </span>
          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
            +{step.delay_days} dni
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditing(!editing)}
            className="text-xs text-gray-600 hover:underline"
          >
            {editing ? "Anuluj" : "Edytuj"}
          </button>
          <button
            onClick={onDelete}
            className="text-xs text-red-600 hover:underline"
          >
            Usuń
          </button>
        </div>
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="space-y-2">
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-700">Delay (dni):</label>
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
            disabled={saving}
            className="rounded-md bg-gray-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? "Zapisywanie..." : "Zapisz"}
          </button>
        </form>
      ) : (
        <>
          <p className="font-medium text-gray-900">{step.subject}</p>
          <pre className="mt-2 whitespace-pre-wrap font-mono text-sm text-gray-700">
            {step.body_template}
          </pre>
        </>
      )}
    </div>
  );
}
