"use client";

import { CompaniesPanel } from "@/components/contacts";

export default function CompaniesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Firmy</h2>
        <p className="mt-1 text-sm text-gray-600">
          Firmy zagregowane z wszystkich Twoich list
        </p>
      </div>
      <CompaniesPanel />
    </div>
  );
}
