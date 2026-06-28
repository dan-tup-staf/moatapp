"use client";

import { FormEvent, useEffect, useState } from "react";
import { GitBranch, Plus, Trash2 } from "lucide-react";

import {
  api,
  ApiError,
  BranchAction,
  BranchCondition,
  EnrollmentOutcome,
  SequenceBranch,
  SequenceStep,
} from "@/lib/api-client";

const CONDITIONS: { value: BranchCondition; label: string }[] = [
  { value: "opened", label: "otworzył maila" },
  { value: "not_opened", label: "nie otworzył maila" },
  { value: "clicked", label: "kliknął link" },
  { value: "not_clicked", label: "nie kliknął linku" },
  { value: "replied", label: "odpowiedział" },
  { value: "not_replied", label: "nie odpowiedział" },
];

const COND_MAP = Object.fromEntries(CONDITIONS.map((c) => [c.value, c.label]));

const ACTIONS: { value: BranchAction; label: string }[] = [
  { value: "stop", label: "zatrzymaj sekwencję" },
  { value: "mark_outcome", label: "ustaw outcome" },
  { value: "add_tag", label: "dodaj tag" },
];

const OUTCOMES: { value: EnrollmentOutcome; label: string }[] = [
  { value: "interested", label: "Zainteresowany" },
  { value: "meeting_booked", label: "Umówione spotkanie" },
  { value: "closed_won", label: "Zamknięty (won)" },
  { value: "not_interested", label: "Niezainteresowany" },
  { value: "out_of_office", label: "Poza biurem" },
];

const OUTCOME_MAP = Object.fromEntries(OUTCOMES.map((o) => [o.value, o.label]));

function actionText(b: SequenceBranch): string {
  if (b.action === "stop") return "zatrzymaj sekwencję";
  if (b.action === "mark_outcome")
    return `ustaw outcome → ${OUTCOME_MAP[b.outcome ?? ""] ?? "—"}`;
  if (b.action === "add_tag") return `dodaj tag → „${b.tag ?? "—"}”`;
  return b.action;
}

export function SubsequenceTab({
  campaignId,
  steps,
}: {
  campaignId: number;
  steps: SequenceStep[];
}) {
  const [branches, setBranches] = useState<SequenceBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function refresh() {
    try {
      setBranches(await api.campaigns.listBranches(campaignId));
    } catch {
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  async function remove(id: number) {
    if (!window.confirm("Usunąć tę regułę?")) return;
    try {
      await api.campaigns.deleteBranch(campaignId, id);
      await refresh();
    } catch (e) {
      alert(e instanceof ApiError ? e.detail : "Błąd");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <GitBranch className="mt-0.5 h-5 w-5 text-gray-400" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Subsequence — rozgałęzienia warunkowe
            </h3>
            <p className="mt-0.5 max-w-xl text-xs text-gray-500">
              Reguły „jeśli → to" wykonywane automatycznie po danym kroku —
              przed wysłaniem kolejnego sprawdzamy zaangażowanie (otwarcie/
              kliknięcie) i stosujemy akcję: zatrzymaj, oznacz wynik lub dodaj tag.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" /> Dodaj regułę
        </button>
      </div>

      {showForm && (
        <BranchForm
          campaignId={campaignId}
          steps={steps}
          onCreated={() => {
            setShowForm(false);
            refresh();
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Ładowanie…</p>
      ) : branches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <GitBranch className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-700">
            Brak rozgałęzień
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Dodaj regułę, np. „po kroku 1, jeśli odpowiedział → zatrzymaj
            sekwencję".
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {branches.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3"
            >
              <span className="inline-flex shrink-0 items-center rounded-md bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700">
                po kroku {b.after_step_order + 1}
              </span>
              <span className="text-sm text-gray-600">jeśli</span>
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {COND_MAP[b.condition]}
              </span>
              <span className="text-sm text-gray-400">→</span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                {actionText(b)}
              </span>
              <button
                onClick={() => remove(b.id)}
                className="ml-auto rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                title="Usuń regułę"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BranchForm({
  campaignId,
  steps,
  onCreated,
  onCancel,
}: {
  campaignId: number;
  steps: SequenceStep[];
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [afterStep, setAfterStep] = useState(0);
  const [condition, setCondition] = useState<BranchCondition>("replied");
  const [action, setAction] = useState<BranchAction>("stop");
  const [outcome, setOutcome] = useState<EnrollmentOutcome>("interested");
  const [tag, setTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.campaigns.createBranch(campaignId, {
        after_step_order: afterStep,
        condition,
        action,
        outcome: action === "mark_outcome" ? outcome : null,
        tag: action === "add_tag" ? tag.trim() || null : null,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd zapisu reguły");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-xl border-2 border-gray-900 bg-white p-4"
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-600">Po kroku</span>
        <select
          value={afterStep}
          onChange={(e) => setAfterStep(Number(e.target.value))}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          {steps.length === 0 ? (
            <option value={0}>krok 1</option>
          ) : (
            steps.map((s, i) => (
              <option key={s.id} value={i}>
                krok {i + 1}
              </option>
            ))
          )}
        </select>
        <span className="text-gray-600">jeśli</span>
        <select
          value={condition}
          onChange={(e) => setCondition(e.target.value as BranchCondition)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          {CONDITIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <span className="text-gray-400">→</span>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value as BranchAction)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          {ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        {action === "mark_outcome" && (
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as EnrollmentOutcome)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            {OUTCOMES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        {action === "add_tag" && (
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="nazwa tagu"
            className="w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          disabled={saving}
          className="rounded-md bg-gray-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? "Zapisuję…" : "Zapisz regułę"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 px-4 py-1.5 text-sm hover:bg-gray-100"
        >
          Anuluj
        </button>
      </div>
    </form>
  );
}
