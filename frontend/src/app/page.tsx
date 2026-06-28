"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  ArrowRight,
  BarChart3,
  Check,
  Eye,
  Inbox,
  Mail,
  Radar,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";

import { useAuth } from "@/contexts/auth-context";
import { PreferencesControls } from "@/components/preferences-controls";

const FEATURES = [
  {
    icon: Radar,
    title: "Sygnały zakupowe",
    desc: "Śledź firmy i osoby pod kątem rekrutacji, finansowania, ekspansji i zmian na stanowiskach — z darmowych i płatnych źródeł.",
  },
  {
    icon: Eye,
    title: "Listy obserwowane",
    desc: "Wgraj bazę z CSV, znajdź firmy/osoby filtrami jak w Lusha i podepnij je do śledzenia sygnałami.",
  },
  {
    icon: Target,
    title: "Profil klienta (ICP)",
    desc: "Zbuduj profil idealnego klienta — ręcznie lub przez AI z adresu www — i punktuj leady automatycznie.",
  },
  {
    icon: Send,
    title: "Sekwencje wielokanałowe",
    desc: "Maile + LinkedIn, warianty A/B z auto-wyborem zwycięzcy, sekwencje warunkowe i gotowe szablony.",
  },
  {
    icon: Inbox,
    title: "Wspólna skrzynka",
    desc: "Wykrywanie odpowiedzi i odbić (IMAP), auto-pauza wątków, jeden inbox na wszystkie konwersacje.",
  },
  {
    icon: ShieldCheck,
    title: "Dostarczalność",
    desc: "Rotacja skrzynek, rozgrzewanie, dopasowanie ESP, limity dzienne i śledzenie otwarć/kliknięć.",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "0 zł",
    period: "na zawsze",
    highlight: false,
    cta: "Zacznij za darmo",
    features: [
      "1 skrzynka mailowa",
      "Do 250 leadów",
      "50 wysyłek / dzień",
      "Profil klienta (ICP) + AI",
      "Sygnały z darmowych źródeł",
    ],
  },
  {
    name: "Pro",
    price: "149 zł",
    period: "/ mies.",
    highlight: true,
    cta: "Wybierz Pro",
    features: [
      "5 skrzynek + rotacja",
      "Do 10 000 leadów",
      "500 wysyłek / dzień",
      "Sekwencje A/B + warunkowe",
      "Wzbogacanie danych (Apollo/Lusha/Prospeo)",
      "Wszystkie źródła sygnałów",
    ],
  },
  {
    name: "Scale",
    price: "Kontakt",
    period: "",
    highlight: false,
    cta: "Porozmawiajmy",
    features: [
      "Nielimitowane skrzynki",
      "Nielimitowane leady",
      "Zespół i role",
      "Webhooki / CRM",
      "Priorytetowe wsparcie",
    ],
  },
];

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) router.replace("/start");
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Ładowanie…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-xl font-bold tracking-tight">MOATION</span>
          <nav className="flex items-center gap-2">
            <PreferencesControls />
            <Link
              href="/login"
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Zaloguj się
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Załóż konto <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-indigo-50/60 to-white" />
        <div className="relative mx-auto max-w-5xl px-6 py-24 text-center">
          <div className="mx-auto mb-5 inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            <Sparkles className="h-3.5 w-3.5" />
            Outreach napędzany sygnałami zakupowymi
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Docieraj do firm{" "}
            <span className="text-indigo-600">w momencie zakupu</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
            MOATION wykrywa sygnały zakupowe, buduje listy idealnych klientów i
            prowadzi wielokanałowe sekwencje (mail + LinkedIn) — wszystko w jednym
            miejscu. Zacznij za darmo, bez karty.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-6 py-3 text-base font-semibold text-white hover:bg-gray-800"
            >
              Załóż konto freemium <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50"
            >
              Mam już konto
            </Link>
          </div>
          <p className="mt-4 text-xs text-gray-400">
            Plan Free na zawsze · bez karty · konfiguracja w 5 minut
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Wszystko czego potrzebujesz do outreachu
          </h2>
          <p className="mt-3 text-gray-600">
            Od wykrycia sygnału, przez zbudowanie listy, po wysłaną sekwencję i
            odpowiedź w skrzynce.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-2xl border border-gray-200 bg-white p-6 transition hover:border-indigo-200 hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-1.5 text-sm text-gray-600">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pricing */}
      <section className="border-y border-gray-100 bg-gray-50/60 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Prosty cennik. Zacznij za darmo.
            </h2>
            <p className="mt-3 text-gray-600">
              Wejdź na planie Free i podnieś poziom, gdy będziesz gotów skalować.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={
                  "relative rounded-2xl border bg-white p-6 " +
                  (p.highlight
                    ? "border-indigo-300 shadow-lg ring-1 ring-indigo-200"
                    : "border-gray-200")
                }
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-medium text-white">
                    Najpopularniejszy
                  </span>
                )}
                <h3 className="font-semibold text-gray-900">{p.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{p.price}</span>
                  {p.period && (
                    <span className="text-sm text-gray-500">{p.period}</span>
                  )}
                </div>
                <ul className="mt-5 space-y-2.5">
                  {p.features.map((feat) => (
                    <li
                      key={feat}
                      className="flex items-start gap-2 text-sm text-gray-700"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className={
                    "mt-6 flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition " +
                    (p.highlight
                      ? "bg-gray-900 text-white hover:bg-gray-800"
                      : "border border-gray-300 text-gray-700 hover:bg-gray-50")
                  }
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <Mail className="mx-auto h-10 w-10 text-indigo-600" />
        <h2 className="mt-4 text-3xl font-bold tracking-tight">
          Gotów docierać do właściwych firm we właściwym czasie?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-gray-600">
          Załóż darmowe konto i odpal pierwszą kampanię opartą o sygnały jeszcze
          dziś.
        </p>
        <Link
          href="/register"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-6 py-3 text-base font-semibold text-white hover:bg-gray-800"
        >
          Załóż konto freemium <ArrowRight className="h-5 w-5" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-sm text-gray-500 sm:flex-row">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="font-semibold text-gray-700">MOATION</span>
          </div>
          <p>© 2026 MOATION. Outreach napędzany sygnałami.</p>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-gray-900">
              Logowanie
            </Link>
            <Link href="/register" className="hover:text-gray-900">
              Rejestracja
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
