"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  Building2,
  Check,
  Copy,
  type LucideIcon,
  Repeat,
  Target,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react";

import { IcpFields, Persona } from "@/lib/api-client";

function CopyTag({ tag }: { tag: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(`{{${tag}}}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard may be blocked — ignore
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      title="Kliknij, aby skopiować merge-tag do treści maila"
      className="group inline-flex shrink-0 items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 transition hover:bg-gray-900 hover:text-white"
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3 opacity-50 group-hover:opacity-100" />
      )}
      {`{{${tag}}}`}
    </button>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tag,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tag: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <CopyTag tag={tag} />
      </div>
      <p className="mt-3 truncate text-2xl font-bold text-gray-900">
        {value || "—"}
      </p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function ListBlock({
  icon: Icon,
  label,
  color,
  items,
  tagPrefix,
}: {
  icon: LucideIcon;
  label: string;
  color: string;
  items: string[];
  tagPrefix: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </span>
      </div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li
            key={i}
            className="flex items-start justify-between gap-2 rounded-md px-1 py-0.5 hover:bg-gray-50"
          >
            <span className="text-sm leading-snug text-gray-700">{it}</span>
            <CopyTag tag={`${tagPrefix}_${i + 1}`} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
];

function PersonaCard({ persona, index }: { persona: Persona; index: number }) {
  const n = index + 1;
  const initials =
    persona.title
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-4 py-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${
            AVATAR_COLORS[index % AVATAR_COLORS.length]
          }`}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-gray-900">
            {persona.title || `Persona ${n}`}
          </p>
          <p className="text-[11px] text-gray-400">
            Komitet zakupowy · Persona {n}
          </p>
        </div>
        <CopyTag tag={`persona_${n}_stanowisko`} />
      </div>
      <div className="grid grid-cols-1 gap-5 p-4 sm:grid-cols-2">
        <ListBlock
          icon={AlertTriangle}
          label="Pain points"
          color="text-rose-500"
          items={persona.pain_points}
          tagPrefix={`persona_${n}_pain`}
        />
        <ListBlock
          icon={TrendingUp}
          label="Gain points"
          color="text-emerald-500"
          items={persona.gain_points}
          tagPrefix={`persona_${n}_gain`}
        />
        <ListBlock
          icon={Target}
          label="Cele osobiste"
          color="text-violet-500"
          items={persona.personal_goals}
          tagPrefix={`persona_${n}_cel_osobisty`}
        />
        <ListBlock
          icon={Briefcase}
          label="Cele zawodowe"
          color="text-blue-500"
          items={persona.professional_goals}
          tagPrefix={`persona_${n}_cel_zawodowy`}
        />
      </div>
    </div>
  );
}

export function ClientProfileView({ fields }: { fields: IcpFields }) {
  const c = fields.company;
  const personas = fields.personas ?? [];
  const hasCompany =
    !!c &&
    (c.employees || c.industry || c.recruitments_per_year || c.hr_employees);

  if (!hasCompany && personas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
        Ten profil powstał przed rozszerzeniem. Kliknij{" "}
        <span className="font-medium text-gray-700">„Przegeneruj z LLM"</span> w
        edytorze powyżej, aby dodać profil firmy i komitet zakupowy.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-gray-900">
          Profil firmy
        </h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Kliknij dowolny merge-tag, aby go skopiować, i wklej do treści maila —
          np. <code className="rounded bg-gray-100 px-1">{"{{firma_branza}}"}</code>.
        </p>
      </div>

      {hasCompany && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            icon={Users}
            label="Pracownicy"
            value={c.employees}
            tag="firma_pracownicy"
            accent="bg-blue-100 text-blue-700"
          />
          <Stat
            icon={Building2}
            label="Branża"
            value={c.industry}
            tag="firma_branza"
            accent="bg-violet-100 text-violet-700"
          />
          <Stat
            icon={Repeat}
            label="Rekrutacje / rok"
            value={c.recruitments_per_year}
            tag="firma_rekrutacje"
            accent="bg-emerald-100 text-emerald-700"
          />
          <Stat
            icon={UserCog}
            label="Dział HR"
            value={c.hr_employees}
            tag="firma_hr"
            accent="bg-amber-100 text-amber-700"
          />
        </div>
      )}

      {personas.length > 0 && (
        <>
          <div className="pt-1">
            <h3 className="text-lg font-semibold tracking-tight text-gray-900">
              Komitet zakupowy
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Każda persona z bólami, korzyściami i celami — z gotowymi
              merge-tagami do hiper-personalizacji wiadomości.
            </p>
          </div>
          <div className="space-y-3">
            {personas.map((p, i) => (
              <PersonaCard key={i} persona={p} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
