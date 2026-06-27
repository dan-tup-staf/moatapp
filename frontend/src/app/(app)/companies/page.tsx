"use client";

import { CompaniesPanel } from "@/components/contacts";

export default function CompaniesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Firmy · Tiering</h2>
        <p className="mt-1 text-sm text-gray-600">
          Firmy zagregowane z list i sygnałów, pogrupowane na Tier 1 / 2 / 3 i
          niekwalifikowane wg score'u. Kliknij kafelek tieru, aby filtrować.
        </p>
      </div>
      <CompaniesPanel />
    </div>
  );
}
