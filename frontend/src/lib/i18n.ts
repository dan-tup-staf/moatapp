"use client";

import { usePreferences } from "@/contexts/preferences-context";

// Translation dictionary. Keys are the canonical Polish UI strings (so untranslated
// strings still render sensibly in PL). EN fills in progressively. Add keys here
// and call t("...") at call sites to localize a screen.
type Dict = Record<string, string>;

const EN: Dict = {
  // Nav groups
  "Zacznij tu": "Get started",
  Strategia: "Strategy",
  "Profil klienta": "Customer profile",
  "Źródła sygnałów": "Signal sources",
  "Listy obserwowane": "Watchlists",
  Pozyskiwanie: "Sourcing",
  Sygnały: "Signals",
  Firmy: "Companies",
  Osoby: "People",
  Listy: "Lists",
  "Wzbogacanie danych": "Data enrichment",
  Zaangażowanie: "Engagement",
  Kampanie: "Campaigns",
  Sekwencje: "Sequences",
  Skrzynka: "Inbox",
  LinkedIn: "LinkedIn",
  Wyniki: "Results",
  Infrastruktura: "Infrastructure",
  Domeny: "Domains",
  Rozgrzewanie: "Warmup",
  Dostarczalność: "Deliverability",
  Analiza: "Analytics",
  Dashboard: "Dashboard",
  Konto: "Account",
  "Profil i konto": "Profile & account",
  "Płatności i plan": "Billing & plan",
  "Użytkownicy i dostępy": "Users & access",
  "Integracje / CRM": "Integrations / CRM",
  Wyloguj: "Log out",
  // Top bar
  "Tryb jasny": "Light mode",
  "Tryb nocny": "Dark mode",
  Język: "Language",
};

const DICTS: Record<string, Dict> = { en: EN };

export function translate(locale: string, key: string): string {
  if (locale === "pl") return key;
  return DICTS[locale]?.[key] ?? key;
}

/** Hook returning a translator bound to the current locale. */
export function useT() {
  const { locale } = usePreferences();
  return (key: string) => translate(locale, key);
}
