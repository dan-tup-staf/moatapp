"use client";

import { IcpPanel } from "@/components/contacts";

export default function IcpPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Profil klienta</h2>
        <p className="mt-1 text-sm text-gray-600">
          Profil idealnego klienta (ICP) — wygenerowany automatycznie z adresu
          www (AI) + doprecyzowany pytaniami. Na dole zobaczysz profil firmy i
          komitet zakupowy z merge-tagami do treści wiadomości.
        </p>
      </div>
      <IcpPanel />
    </div>
  );
}
