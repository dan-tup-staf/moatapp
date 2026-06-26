import { Sparkles } from "lucide-react";

export type PlannedFeature = { title: string; desc: string };

export function ComingSoon({
  title,
  subtitle,
  features,
  note,
}: {
  title: string;
  subtitle: string;
  features: PlannedFeature[];
  note?: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <Sparkles className="h-4 w-4 shrink-0" />
        <span>
          <span className="font-medium">W budowie.</span>{" "}
          {note ??
            "Ta sekcja jest zaplanowana — poniżej zakres, który tu powstanie."}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-lg border border-gray-200 bg-white p-4"
          >
            <h3 className="text-sm font-semibold text-gray-900">{f.title}</h3>
            <p className="mt-1 text-sm text-gray-600">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
