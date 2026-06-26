"use client";

import { PeoplePanel } from "@/components/contacts";

export default function PeoplePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Osoby</h2>
        <p className="mt-1 text-sm text-gray-600">
          Wszystkie osoby z wszystkich list
        </p>
      </div>
      <PeoplePanel />
    </div>
  );
}
