"use client";

import { ComingSoon } from "@/components/coming-soon";

export default function AccountUsersPage() {
  return (
    <ComingSoon
      title="Użytkownicy i dostępy"
      subtitle="Zarządzaj zespołem i uprawnieniami"
      features={[
        {
          title: "Zapraszanie użytkowników",
          desc: "Dodawaj członków zespołu mailem, z linkiem do dołączenia.",
        },
        {
          title: "Role i uprawnienia",
          desc: "Owner / Admin / Member — kontrola, kto co widzi i może edytować.",
        },
        {
          title: "Zarządzanie dostępem",
          desc: "Zmiana ról, zawieszanie i usuwanie dostępu użytkowników.",
        },
        {
          title: "Audyt",
          desc: "Kto i kiedy się logował oraz wykonywał kluczowe akcje.",
        },
      ]}
    />
  );
}
