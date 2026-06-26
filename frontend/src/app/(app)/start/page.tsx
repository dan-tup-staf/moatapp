"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Layers,
  type LucideIcon,
  Plug,
  Radar,
  Send,
  Target,
} from "lucide-react";

import { api } from "@/lib/api-client";
import { useAuth } from "@/contexts/auth-context";

type Step = {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  cta: string;
  done: boolean;
  optional?: boolean;
};

export default function StartPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [flags, setFlags] = useState({
    icp: false,
    tiers: false,
    signals: false,
    campaign: false,
  });

  useEffect(() => {
    (async () => {
      const [icp, companies, sources, campaigns] = await Promise.allSettled([
        api.icp.get(),
        api.companies.list(),
        api.signalSources.list(),
        api.campaigns.list(),
      ]);

      const icpDone =
        icp.status === "fulfilled" &&
        !!icp.value?.icp_fields &&
        (icp.value.icp_fields.target_industries.length > 0 ||
          icp.value.icp_fields.buyer_persona_titles.length > 0 ||
          !!icp.value.icp_fields.company_size);

      setFlags({
        icp: icpDone,
        tiers:
          companies.status === "fulfilled" && companies.value.length > 0,
        signals: sources.status === "fulfilled" && sources.value.length > 0,
        campaign:
          campaigns.status === "fulfilled" && campaigns.value.length > 0,
      });
      setLoading(false);
    })();
  }, []);

  const steps: Step[] = [
    {
      icon: Target,
      title: "Określ swój ICP",
      description:
        "Wklej adres www klienta — AI (Gemini) przeszuka internet i wygeneruje Ideal Customer Profile: branże, persony, pain points, triggery zakupowe.",
      href: "/icp",
      cta: "Przejdź do ICP",
      done: flags.icp,
    },
    {
      icon: Layers,
      title: "Podziel firmy na Tier 1 / 2 / 3",
      description:
        "Przejrzyj firmy zagregowane z list i sygnałów. Wyższy score = wyższy tier (Tier 1 = najgorętsze). Pozostałe odłóż jako niekwalifikowane.",
      href: "/companies",
      cta: "Przejdź do Firm",
      done: flags.tiers,
    },
    {
      icon: Radar,
      title: "Wybierz źródła sygnałów",
      description:
        "Aktywuj kanały sygnałów zakupowych: presety PL, pracuj.pl, RSS lub kanały web (LinkedIn, News, SERP, funding) zasilane przez AI.",
      href: "/signal-sources",
      cta: "Przejdź do Źródeł",
      done: flags.signals,
    },
    {
      icon: Send,
      title: "Ustaw kampanię",
      description:
        "Zbuduj sekwencję wiadomości (multichannel), wybierz odbiorców z list / tierów i odpal outreach.",
      href: "/campaigns",
      cta: "Przejdź do Kampanii",
      done: flags.campaign,
    },
    {
      icon: Plug,
      title: "Połącz CRM (opcjonalnie)",
      description:
        "Zintegruj swój CRM, aby synchronizować leady i statusy. Krok opcjonalny — możesz wrócić do niego później.",
      href: "/integrations",
      cta: "Przejdź do Integracji",
      done: false,
      optional: true,
    },
  ];

  const coreSteps = steps.filter((s) => !s.optional);
  const completed = coreSteps.filter((s) => s.done).length;
  const total = coreSteps.length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const firstName = user?.email?.split("@")[0] ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Cześć {firstName} 👋
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Przejdź te kroki, aby wysłać pierwszą kampanię opartą o sygnały
          zakupowe.
        </p>
      </div>

      {/* Progress */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-900">
            {loading
              ? "Sprawdzam postęp…"
              : completed === total
                ? "Gotowe — wszystkie kroki ukończone 🎉"
                : `${completed} z ${total} kroków ukończone`}
          </p>
          <span className="text-sm font-semibold text-gray-500">{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gray-900 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div
              key={i}
              className={
                "rounded-lg border bg-white p-4 transition " +
                (step.done
                  ? "border-emerald-200"
                  : "border-gray-200 hover:border-gray-300")
              }
            >
              <div className="flex items-start gap-4">
                <div className="mt-0.5 shrink-0">
                  {step.done ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  ) : (
                    <Circle className="h-6 w-6 text-gray-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-900">
                      {step.title}
                    </h3>
                    {step.optional && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
                        opcjonalne
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {step.description}
                  </p>
                  <div className="mt-3">
                    <Link
                      href={step.href}
                      className={
                        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition " +
                        (step.done
                          ? "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                          : "bg-gray-900 text-white hover:bg-gray-800")
                      }
                    >
                      {step.done ? "Otwórz" : step.cta}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
