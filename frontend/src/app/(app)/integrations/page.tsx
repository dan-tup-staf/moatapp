"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  Building2,
  ChevronDown,
  Construction,
  Mail,
  type LucideIcon,
  Sparkles,
} from "lucide-react";

import { api, ApiError, EmailStatus } from "@/lib/api-client";

type Integration = {
  id: string;
  name: string;
  kind: "CRM" | "Email" | "Enrichment";
  status: "available" | "coming_soon";
  description: string;
  push: string[];
  pull: string[];
};

const INTEGRATIONS: Integration[] = [
  {
    id: "hubspot",
    name: "HubSpot",
    kind: "CRM",
    status: "coming_soon",
    description:
      "Dwukierunkowa synchronizacja kontaktów, firm i aktywności. Push naszych eventów (sent/opened/replied) jako Engagements, pull stage z HubSpot Deals.",
    push: [
      "Lead → HubSpot Contact (email, imię, firma, title)",
      "Firma → HubSpot Company (nazwa, domain, score jako custom property)",
      "Wysłany mail → HubSpot Engagement (EMAIL)",
      "Sygnał pracuj.pl → HubSpot Note na firmie",
    ],
    pull: [
      "HubSpot Deal stage → nasz pipeline.stage override",
      "HubSpot Contact properties → update Lead (firma, title)",
      "Webhook na Deal stage change → real-time update",
    ],
  },
  {
    id: "salesforce",
    name: "Salesforce",
    kind: "CRM",
    status: "coming_soon",
    description:
      "Integracja z Sales Cloud. Lead/Contact/Account/Opportunity sync przez Salesforce REST API + Platform Events.",
    push: [
      "Lead → Salesforce Lead lub Contact (zależnie od Account status)",
      "Firma → Salesforce Account",
      "Campaign enrollment → Salesforce Campaign Member",
      "Sent/opened events → Task lub custom object",
    ],
    pull: [
      "Salesforce Opportunity Stage → nasz pipeline.stage",
      "Salesforce Campaign status → enrollment status",
      "Platform Events → real-time update",
    ],
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    kind: "CRM",
    status: "coming_soon",
    description:
      "Sync z Pipedrive Persons/Organizations/Deals przez REST API.",
    push: [
      "Lead → Pipedrive Person",
      "Firma → Pipedrive Organization",
      "Campaign email → Pipedrive Activity (type email)",
    ],
    pull: [
      "Pipedrive Deal stage → nasz pipeline.stage",
      "Deal custom fields → Lead custom data",
    ],
  },
  {
    id: "apollo",
    name: "Apollo.io",
    kind: "Enrichment",
    status: "coming_soon",
    description:
      "Wzbogacanie leadów — zamień nazwę firmy na kontakty (emaile HR/sales/owners) żeby automatycznie kończyć pipeline pracuj.pl → real outreach.",
    push: [
      "Company z signal → Apollo Company lookup",
      "Role filter (HR Manager, Director) → Apollo People search",
      "Zwrot: email + LinkedIn + title → auto-create Lead w wybranej liście",
    ],
    pull: [],
  },
  {
    id: "hunter",
    name: "Hunter.io",
    kind: "Enrichment",
    status: "coming_soon",
    description:
      "Tańszy alternatywny enrichment — Domain Search zwraca emaile z danej firmy. Używany jako fallback gdy Apollo brakuje danych.",
    push: [
      "Company domain → Hunter domain-search",
      "Email verification (deliverability score)",
      "Auto-create Lead z high-confidence wynikami",
    ],
    pull: [],
  },
  {
    id: "linkedin_ads",
    name: "LinkedIn Matched Audiences",
    kind: "Email",
    status: "coming_soon",
    description:
      "Upload lead list z kampanii do LinkedIn Matched Audiences — \"ogrzewanie\" prospektów reklamami przed cold mailem. Wymaga LinkedIn Ads konta klienta.",
    push: [
      "Lista enrollmentów → LinkedIn Matched Audience (email-based)",
      "Auto-sync gdy lista rośnie",
    ],
    pull: ["LinkedIn: ile osób z audience widziało reklamy (impressions)"],
  },
];

const KIND_STYLES: Record<Integration["kind"], string> = {
  CRM: "bg-purple-100 text-purple-800",
  Enrichment: "bg-blue-100 text-blue-800",
  Email: "bg-emerald-100 text-emerald-800",
};

const KIND_ICONS: Record<Integration["kind"], LucideIcon> = {
  CRM: Building2,
  Enrichment: Sparkles,
  Email: Mail,
};

const KIND_ACCENTS: Record<Integration["kind"], string> = {
  CRM: "bg-purple-100 text-purple-700",
  Enrichment: "bg-blue-100 text-blue-700",
  Email: "bg-emerald-100 text-emerald-700",
};

export default function IntegrationsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Integracje</h2>
        <p className="mt-1 text-sm text-gray-600">
          Zewnętrzne systemy podłączone do MOATION
        </p>
      </div>

      <MailboxCard />

      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <Construction className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="font-medium">Roadmap — jeszcze niezaimplementowane</p>
          <p className="mt-1 text-xs text-amber-800">
            Wszystkie integracje poniżej to placeholders. Architektura jest
            gotowa (hook points w signal service, campaign sender, pipeline
            service), ale faktyczne wywołania cudzych API wymagają kluczy
            klienta i OAuth flow — będziemy dodawać per klient gdy pojawi się
            potrzeba.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {INTEGRATIONS.map((i) => (
          <IntegrationCard
            key={i.id}
            integration={i}
            expanded={expanded === i.id}
            onToggle={() => setExpanded(expanded === i.id ? null : i.id)}
          />
        ))}
      </div>
    </div>
  );
}

function MailboxCard() {
  const [status, setStatus] = useState<EmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setStatus(await api.email.status());
      } catch {
        setStatus(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function sendTest() {
    setTesting(true);
    setMsg(null);
    try {
      const res = await api.email.test();
      setMsg({
        ok: true,
        text: `Wysłano test na ${res.sent_to}. Sprawdź skrzynkę (także spam).`,
      });
    } catch (err) {
      setMsg({
        ok: false,
        text: err instanceof ApiError ? err.detail : "Błąd wysyłki",
      });
    } finally {
      setTesting(false);
    }
  }

  const configured = status?.configured ?? false;
  const security = status?.use_tls
    ? "TLS (465)"
    : status?.starttls
      ? "STARTTLS (587)"
      : "brak";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <Mail className="h-4 w-4" />
          </div>
          <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">
              Skrzynka wysyłkowa (SMTP)
            </span>
            {!loading && (
              <span
                className={
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] " +
                  (configured
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800")
                }
              >
                <span
                  className={
                    "h-1.5 w-1.5 rounded-full " +
                    (configured ? "bg-emerald-500" : "bg-amber-500")
                  }
                />
                {configured ? "Podłączona" : "Nie skonfigurowana"}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Skrzynka, z której wychodzą kampanie. Konfiguracja przez zmienne
            środowiskowe usługi{" "}
            <code className="rounded bg-gray-100 px-1">moation-api</code> na
            Render (SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD…).
          </p>
          {!loading && status && (
            <p className="mt-2 text-xs text-gray-500">
              Host:{" "}
              <span className="font-mono">
                {status.host}:{status.port}
              </span>{" "}
              · Szyfrowanie: {security} · Nadawca:{" "}
              <span className="font-mono">
                {status.from_email || "(domyślny z kampanii)"}
              </span>{" "}
              · Limit/dzień: {status.daily_limit || "∞"}
            </p>
          )}
          </div>
        </div>
        <button
          onClick={sendTest}
          disabled={testing}
          className="shrink-0 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {testing ? "Wysyłam…" : "Wyślij testowy mail"}
        </button>
      </div>

      {!loading && !configured && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Brak loginu/hasła SMTP — wysyłka trafia do dev-skrzynki i nie dotrze do
          prawdziwych adresów. Ustaw SMTP_USERNAME i SMTP_PASSWORD na moation-api.
        </p>
      )}
      {msg && (
        <p
          className={
            "mt-3 rounded-md px-3 py-2 text-sm " +
            (msg.ok
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-700")
          }
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}

function IntegrationCard({
  integration: i,
  expanded,
  onToggle,
}: {
  integration: Integration;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = KIND_ICONS[i.kind];
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-gray-50"
      >
        <div className="flex min-w-0 flex-1 gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${KIND_ACCENTS[i.kind]}`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{i.name}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] ${KIND_STYLES[i.kind]}`}
              >
                {i.kind}
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                {i.status === "coming_soon" ? "Wkrótce" : "Dostępne"}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600">{i.description}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              alert(
                `${i.name} wymaga OAuth do cudzego systemu + klucza API klienta. ` +
                  `Implementacja per klient gdy pojawi się potrzeba.`,
              );
            }}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-100"
            disabled
            title="Nie zaimplementowane"
          >
            Połącz
          </button>
          <ChevronDown
            className={
              "h-4 w-4 text-gray-400 transition-transform " +
              (expanded ? "rotate-180" : "")
            }
          />
        </div>
      </button>

      {expanded && (
        <div className="grid grid-cols-1 gap-4 border-t border-gray-100 bg-gray-50/50 p-4 text-sm md:grid-cols-2">
          {i.push.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                <ArrowRightToLine className="h-3.5 w-3.5 text-emerald-500" />
                Push (MOATION → {i.name})
              </p>
              <ul className="space-y-1.5 text-gray-700">
                {i.push.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-400" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {i.pull.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
                <ArrowLeftToLine className="h-3.5 w-3.5 text-blue-500" />
                Pull ({i.name} → MOATION)
              </p>
              <ul className="space-y-1.5 text-gray-700">
                {i.pull.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
