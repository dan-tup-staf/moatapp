"use client";

import { CalendarCheck, CheckCircle2, Flag, Loader2, Plug, Target } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  api,
  ApiError,
  Campaign,
  CrmProvider,
  TriggerProvider,
} from "@/lib/api-client";

// Which trigger needs which account connected.
const TRIGGER_PROVIDER: Record<string, string> = {
  meeting_calendly: "calendly",
  meeting_confirmed: "google_calendar",
};

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
  const [triggers, setTriggers] = useState<TriggerProvider[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function loadTriggers() {
    try {
      setTriggers(await api.triggerIntegrations.providers());
    } catch {
      setTriggers([]);
    }
  }

  useEffect(() => {
    api.crmIntegrations
      .providers()
      .then((p) => setCrms(p.filter((x) => x.connected)))
      .catch(() => setCrms([]));
    loadTriggers();
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
    <div className="relative">
      {/* Connector from the last step above */}
      <div className="ml-9 h-5 w-px bg-indigo-200" />
      <div className="rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/40 p-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Flag className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Krok końcowy
              </span>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                Cel sekwencji
                {configured && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    aktywny
                  </span>
                )}
              </h3>
            </div>
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
          {TRIGGER_PROVIDER[goalType] && (
            <TriggerConnect
              provider={
                triggers.find((t) => t.key === TRIGGER_PROVIDER[goalType]) ||
                null
              }
              providerKey={TRIGGER_PROVIDER[goalType]}
              onChanged={loadTriggers}
            />
          )}
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
    </div>
  );
}

function TriggerConnect({
  provider,
  providerKey,
  onChanged,
}: {
  provider: TriggerProvider | null;
  providerKey: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const name = provider?.name || (providerKey === "calendly" ? "Calendly" : "Google Calendar");
  const isOauth = provider?.connect_kind === "oauth";

  async function connect() {
    if (!token.trim()) return;
    setBusy(true);
    try {
      await api.triggerIntegrations.connect(providerKey, token.trim());
      setToken("");
      setOpen(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    await api.triggerIntegrations.disconnect(providerKey);
    onChanged();
  }

  return (
    <div className="mt-2 rounded-md border border-indigo-100 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
          <CalendarCheck className="h-3.5 w-3.5 text-indigo-500" />
          Konto {name}
        </span>
        {provider?.connected ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> połączone
          </span>
        ) : (
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-md bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700"
          >
            Połącz {name}
          </button>
        )}
      </div>

      {provider?.connected ? (
        <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
          <span className="font-mono">{provider.token_masked}</span>
          <button
            onClick={disconnect}
            className="text-red-600 hover:underline"
          >
            odłącz
          </button>
        </div>
      ) : (
        open && (
          <div className="mt-2 space-y-1.5">
            <p className="text-[11px] text-gray-400">{provider?.key_hint}</p>
            {isOauth ? (
              <p className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                Google Calendar wymaga połączenia OAuth — dokończymy je po
                przekazaniu danych aplikacji Google (client id/secret). Do tego
                czasu użyj triggera „Ręczne oznaczenie" lub Calendly.
              </p>
            ) : (
              <>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Personal Access Token"
                  className="w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs"
                />
                <button
                  onClick={connect}
                  disabled={busy || !token.trim()}
                  className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {busy ? "Łączę…" : "Zapisz połączenie"}
                </button>
              </>
            )}
          </div>
        )
      )}
    </div>
  );
}
