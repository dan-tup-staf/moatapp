"use client";

import { useState } from "react";

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

export default function IntegrationsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Integracje</h2>
        <p className="mt-1 text-sm text-gray-600">
          Zewnętrzne systemy które będą podłączone do MOATION
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">🚧 Roadmap — jeszcze niezaimplementowane</p>
        <p className="mt-1 text-xs text-amber-800">
          Wszystkie integracje poniżej to placeholders. Architektura jest
          gotowa (hook points w signal service, campaign sender, pipeline
          service), ale faktyczne wywołania cudzych API wymagają kluczy klienta
          i OAuth flow — będziemy dodawać per klient gdy pojawi się potrzeba.
        </p>
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

function IntegrationCard({
  integration: i,
  expanded,
  onToggle,
}: {
  integration: Integration;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <button
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-gray-50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{i.name}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${KIND_STYLES[i.kind]}`}
            >
              {i.kind}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {i.status === "coming_soon" ? "Coming soon" : "Available"}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">{i.description}</p>
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
            className="rounded-md border border-gray-300 px-3 py-1 text-xs text-gray-500 hover:bg-gray-100"
            disabled
            title="Nie zaimplementowane"
          >
            Połącz
          </button>
          <span className="text-gray-400">{expanded ? "▾" : "▸"}</span>
        </div>
      </button>

      {expanded && (
        <div className="grid grid-cols-1 gap-4 border-t border-gray-200 p-4 text-sm md:grid-cols-2">
          {i.push.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                Push (MOATION → {i.name})
              </p>
              <ul className="space-y-1 text-gray-700">
                {i.push.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="text-gray-400">→</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {i.pull.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                Pull ({i.name} → MOATION)
              </p>
              <ul className="space-y-1 text-gray-700">
                {i.pull.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="text-gray-400">←</span>
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
