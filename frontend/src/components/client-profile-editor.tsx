"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  Building2,
  Pencil,
  Plus,
  Repeat,
  Target,
  TrendingUp,
  Trash2,
  UserCog,
  Users,
  UserPlus,
  X,
} from "lucide-react";

import { CompanyProfile, IcpFields, Persona } from "@/lib/api-client";
import { ClientProfileView } from "@/components/client-profile";

const EMPTY_COMPANY: CompanyProfile = {
  employees: "",
  industry: "",
  recruitments_per_year: "",
  hr_employees: "",
};

const EMPTY_PERSONA: Persona = {
  title: "",
  pain_points: [],
  gain_points: [],
  personal_goals: [],
  professional_goals: [],
};

function splitLines(s: string): string[] {
  return s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

// ---------- Section wrapper: view <-> edit toggle ----------

export function ClientProfileSection({
  fields,
  saving,
  onSave,
  initialEditing = false,
}: {
  fields: IcpFields;
  saving: boolean;
  onSave: (patch: {
    company: CompanyProfile;
    personas: Persona[];
  }) => Promise<void>;
  initialEditing?: boolean;
}) {
  const c = fields.company ?? EMPTY_COMPANY;
  const personas = fields.personas ?? [];
  const hasCompany =
    !!c &&
    (c.employees || c.industry || c.recruitments_per_year || c.hr_employees);
  const isEmpty = !hasCompany && personas.length === 0;

  const [editing, setEditing] = useState(initialEditing);

  if (editing) {
    return (
      <ClientProfileEditor
        fields={fields}
        saving={saving}
        onSave={async (patch) => {
          await onSave(patch);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  if (isEmpty) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <Building2 className="h-6 w-6 text-gray-500" />
        </div>
        <h3 className="mt-3 text-base font-semibold text-gray-900">
          Stwórz profil klienta
        </h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
          Zdefiniuj profil idealnej firmy oraz komitet zakupowy (persony z
          bólami, korzyściami i celami). Z gotowych merge-tagów zbudujesz
          hiper-spersonalizowane wiadomości.
        </p>
        <button
          onClick={() => setEditing(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" />
          Stwórz profil ręcznie
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edytuj profil
        </button>
      </div>
      <ClientProfileView fields={fields} />
    </div>
  );
}

// ---------- Editor ----------

function ClientProfileEditor({
  fields,
  saving,
  onSave,
  onCancel,
}: {
  fields: IcpFields;
  saving: boolean;
  onSave: (patch: {
    company: CompanyProfile;
    personas: Persona[];
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [company, setCompany] = useState<CompanyProfile>({
    ...EMPTY_COMPANY,
    ...(fields.company ?? {}),
  });
  const [personas, setPersonas] = useState<Persona[]>(
    (fields.personas ?? []).map((p) => ({ ...EMPTY_PERSONA, ...p })),
  );

  function setCompanyField(key: keyof CompanyProfile, value: string) {
    setCompany((c) => ({ ...c, [key]: value }));
  }

  function addPersona() {
    setPersonas((ps) => [...ps, { ...EMPTY_PERSONA }]);
  }
  function removePersona(i: number) {
    setPersonas((ps) => ps.filter((_, idx) => idx !== i));
  }
  function updatePersona(i: number, next: Persona) {
    setPersonas((ps) => ps.map((p, idx) => (idx === i ? next : p)));
  }

  async function handleSave() {
    await onSave({
      company,
      personas: personas.filter(
        (p) =>
          p.title.trim() ||
          p.pain_points.length ||
          p.gain_points.length ||
          p.personal_goals.length ||
          p.professional_goals.length,
      ),
    });
  }

  return (
    <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Company */}
      <div>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-gray-500" />
          <h3 className="text-base font-semibold text-gray-900">
            Profil firmy
          </h3>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">
          Opisz idealną firmę-klienta. Te wartości są dostępne jako merge-tagi
          (np. <code className="rounded bg-gray-100 px-1">{"{{firma_branza}}"}</code>).
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CompanyInput
            icon={Users}
            label="Pracownicy"
            tag="firma_pracownicy"
            value={company.employees}
            onChange={(v) => setCompanyField("employees", v)}
            placeholder="np. 50-500"
          />
          <CompanyInput
            icon={Building2}
            label="Branża"
            tag="firma_branza"
            value={company.industry}
            onChange={(v) => setCompanyField("industry", v)}
            placeholder="np. SaaS / e-commerce"
          />
          <CompanyInput
            icon={Repeat}
            label="Rekrutacje / rok"
            tag="firma_rekrutacje"
            value={company.recruitments_per_year}
            onChange={(v) => setCompanyField("recruitments_per_year", v)}
            placeholder="np. 20-40"
          />
          <CompanyInput
            icon={UserCog}
            label="Dział HR"
            tag="firma_hr"
            value={company.hr_employees}
            onChange={(v) => setCompanyField("hr_employees", v)}
            placeholder="np. 3-5 osób"
          />
        </div>
      </div>

      {/* Buying committee */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-gray-500" />
              <h3 className="text-base font-semibold text-gray-900">
                Komitet zakupowy
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              Dodaj persony decyzyjne — każda z bólami, korzyściami i celami.
            </p>
          </div>
          <button
            onClick={addPersona}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Dodaj personę
          </button>
        </div>

        {personas.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400">
            Brak person. Kliknij „Dodaj personę", aby zbudować komitet zakupowy.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {personas.map((p, i) => (
              <PersonaEditorCard
                key={i}
                index={i}
                persona={p}
                onChange={(next) => updatePersona(i, next)}
                onRemove={() => removePersona(i)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {saving ? "Zapisuję…" : "Zapisz profil"}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
          Anuluj
        </button>
      </div>
    </div>
  );
}

function CompanyInput({
  icon: Icon,
  label,
  tag,
  value,
  onChange,
  placeholder,
}: {
  icon: typeof Building2;
  label: string;
  tag: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-gray-500">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
      <p className="mt-1 font-mono text-[10px] text-gray-400">{`{{${tag}}}`}</p>
    </div>
  );
}

const PERSONA_AVATARS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
];

function PersonaEditorCard({
  index,
  persona,
  onChange,
  onRemove,
}: {
  index: number;
  persona: Persona;
  onChange: (next: Persona) => void;
  onRemove: () => void;
}) {
  const n = index + 1;
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
            PERSONA_AVATARS[index % PERSONA_AVATARS.length]
          }`}
        >
          {n}
        </div>
        <input
          type="text"
          value={persona.title}
          onChange={(e) => onChange({ ...persona, title: e.target.value })}
          placeholder="Stanowisko, np. Dyrektor HR"
          className="flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm font-medium focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
        />
        <button
          onClick={onRemove}
          title="Usuń personę"
          className="shrink-0 text-gray-400 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
        <ListField
          icon={AlertTriangle}
          label="Pain points"
          color="text-rose-500"
          tagPrefix={`persona_${n}_pain`}
          items={persona.pain_points}
          onChange={(v) => onChange({ ...persona, pain_points: v })}
        />
        <ListField
          icon={TrendingUp}
          label="Gain points"
          color="text-emerald-500"
          tagPrefix={`persona_${n}_gain`}
          items={persona.gain_points}
          onChange={(v) => onChange({ ...persona, gain_points: v })}
        />
        <ListField
          icon={Target}
          label="Cele osobiste"
          color="text-violet-500"
          tagPrefix={`persona_${n}_cel_osobisty`}
          items={persona.personal_goals}
          onChange={(v) => onChange({ ...persona, personal_goals: v })}
        />
        <ListField
          icon={Briefcase}
          label="Cele zawodowe"
          color="text-blue-500"
          tagPrefix={`persona_${n}_cel_zawodowy`}
          items={persona.professional_goals}
          onChange={(v) => onChange({ ...persona, professional_goals: v })}
        />
      </div>
    </div>
  );
}

function ListField({
  icon: Icon,
  label,
  color,
  tagPrefix,
  items,
  onChange,
}: {
  icon: typeof Building2;
  label: string;
  color: string;
  tagPrefix: string;
  items: string[];
  onChange: (v: string[]) => void;
}) {
  // Keep the raw textarea text in local state so spaces (incl. the trailing
  // one you just typed) survive — we only split/trim when propagating up, not
  // on every keystroke (which would strip the space before the next word).
  const [text, setText] = useState(items.join("\n"));

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${color}`} />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </span>
        <span className="ml-auto font-mono text-[10px] text-gray-400">
          {`{{${tagPrefix}_N}}`}
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(splitLines(e.target.value));
        }}
        rows={3}
        placeholder="Każdy punkt w nowej linii…"
        className="block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
    </div>
  );
}
