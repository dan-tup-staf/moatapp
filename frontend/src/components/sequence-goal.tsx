"use client";

import { Flag, Loader2, Plug, Target } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { api, ApiError, Campaign, CrmProvider } from "@/lib/api-client";

const GOAL_TYPES: { value: string; label: string }[] = [
  { value: "none", label: "— brak celu —" },
  { value: "meeting_calendly", label: "Umówienie spotkania (Calendly)" },
  { value: "meeting_confirmed", label: "Potwierdzenie spotkania (Google Meet)" },
  { value: "demo_form", label: "Formularz na Demo produktowe" },
  { value: "positive_reply", label: "Pozytywna odpowiedź" },
  { value: "manual", label: "Ręczne oznaczenie" },
];

const CRM_ACTIONS: { value: string; label: string; desc: string }[] = [
  { value: "none", label: "Nic nie rób", desc: "Tylko oznacz konwersję" },
  {
    value: "contact",
    label: "Dodaj Kontakt",
    desc: "Utwórz kontakt w CRM",
  },
  {
    value: "task",
    label: "Zadanie dla handlowca",
    desc: "Utwórz zadanie do kontaktu",
  },
  {
    value: "deal",
    label: "Szansa sprzedaży",
    desc: "Utwórz deala w CRM",
  },
];

export function SequenceGoalCard({
  campaign,
  onSaved,
}: {
  campaign: Campaign;
  onSaved: () => void;
}) {
  const [goalType, setGoalType] = useState(campaign.goal_type || "none");
  const [action, setAction] = useState(campaign.goal_crm_action || "none");
  const [provider, setProvider] = useState(campaign.goal_crm_provider || "");
  const [taskNote, setTaskNote] = useState(campaign.goal_task_note || "");
  const [dealValue, setDealValue] = useState<string>(
    campaign.goal_deal_value != null ? String(campaign.goal_deal_value) : "",
  );
  const [crms, setCrms] = useState<CrmProvider[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api.crmIntegrations
      .providers()
      .then((p) => setCrms(p.filter((x) => x.connected)))
      .catch(() => setCrms([]));
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await api.campaigns.update(campaign.id, {
        goal_type: goalType,
        goal_crm_action: action,
        goal_crm_provider: action === "none" ? null : provider || null,
        goal_task_note: action === "task" ? taskNote || null : null,
        goal_deal_value:
          action === "deal" && dealValue ? Number(dealValue) : null,
      });
      setMsg("Zapisano cel sekwencji.");
      onSaved();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.detail : "Błąd zapisu");
    } finally {
      setSaving(false);
    }
  }

  const configured = action !== "none" || goalType !== "none";

  return (
    <div className="relative rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Flag className="h-4 w-4" />
        </div>
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            Cel sekwencji
            {configured && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                aktywny
              </span>
            )}
          </h3>
          <p className="text-xs text-gray-500">
            Domknięcie lejka — po osiągnięciu celu lead trafia do CRM.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Trigger */}
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <Target className="h-3.5 w-3.5 text-indigo-500" /> Kiedy (trigger)
          </label>
          <select
            value={goalType}
            onChange={(e) => setGoalType(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {GOAL_TYPES.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </div>

        {/* CRM action */}
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <Plug className="h-3.5 w-3.5 text-indigo-500" /> Akcja w CRM
          </label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {CRM_ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label} — {a.desc}
              </option>
            ))}
          </select>
        </div>
      </div>

      {action !== "none" && (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              CRM docelowy
            </label>
            {crms.length === 0 ? (
              <p className="rounded-md bg-white px-3 py-2 text-xs text-gray-500">
                Brak podłączonego CRM.{" "}
                <Link
                  href="/integrations"
                  className="text-indigo-600 hover:underline"
                >
                  Podłącz CRM
                </Link>{" "}
                — do tego czasu cel pushuje dane przez webhook.
              </p>
            ) : (
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">— webhook (domyślnie) —</option>
                {crms.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {action === "task" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Treść zadania
              </label>
              <input
                value={taskNote}
                onChange={(e) => setTaskNote(e.target.value)}
                placeholder="np. Zadzwoń i potwierdź demo"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}

          {action === "deal" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Wartość szansy (PLN)
              </label>
              <input
                type="number"
                min={0}
                value={dealValue}
                onChange={(e) => setDealValue(e.target.value)}
                placeholder="np. 12000"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Zapisz cel
        </button>
        {msg && <span className="text-sm text-gray-600">{msg}</span>}
      </div>
    </div>
  );
}
