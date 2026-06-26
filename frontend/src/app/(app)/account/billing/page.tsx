"use client";

import { ComingSoon } from "@/components/coming-soon";

export default function AccountBillingPage() {
  return (
    <ComingSoon
      title="Płatności i plan"
      subtitle="Subskrypcja, faktury i zużycie"
      features={[
        {
          title: "Plan i funkcje",
          desc: "Co jest włączone/wyłączone w Twoim planie; upgrade/downgrade.",
        },
        {
          title: "Formy płatności",
          desc: "Dodawanie i zmiana karty; integracja billingowa (np. Stripe).",
        },
        {
          title: "Faktury",
          desc: "Historia płatności i pobieranie faktur PDF.",
        },
        {
          title: "Zużycie kredytów / limity",
          desc: "Wykorzystanie limitów AI i wysyłek, alerty przy zbliżaniu się do progu.",
        },
      ]}
    />
  );
}
