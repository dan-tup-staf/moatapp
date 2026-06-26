"use client";

import { ComingSoon } from "@/components/coming-soon";

export default function DomainsPage() {
  return (
    <ComingSoon
      title="Domeny"
      subtitle="Podłączaj i zarządzaj domenami wysyłkowymi"
      features={[
        {
          title: "Podłącz domenę",
          desc: "Dodaj domenę wysyłkową i połącz z nią skrzynki. Jedna firma, wiele domen.",
        },
        {
          title: "Weryfikacja DNS",
          desc: "Automatyczne sprawdzanie SPF / DKIM / DMARC ze statusem ✓/✗ i instrukcją co wkleić u rejestratora.",
        },
        {
          title: "Wiele domen naraz",
          desc: "Lista wszystkich domen, ich status zdrowia i przypisane skrzynki w jednym miejscu.",
        },
        {
          title: "Rotacja domen",
          desc: "Rozkładanie wysyłek na kilka domen/skrzynek dla lepszej dostarczalności przy skali.",
        },
      ]}
    />
  );
}
