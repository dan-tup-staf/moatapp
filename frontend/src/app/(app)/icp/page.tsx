"use client";

import { IcpPanel } from "@/components/contacts";

export default function IcpPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">ICP</h2>
        <p className="mt-1 text-sm text-gray-600">
          Ideal Customer Profile — wygenerowany automatycznie z adresu www
          Twojego klienta (AI) + doprecyzowany pytaniami
        </p>
      </div>
      <IcpPanel />
    </div>
  );
}
