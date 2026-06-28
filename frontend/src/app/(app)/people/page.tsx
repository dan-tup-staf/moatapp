"use client";

import { PeoplePanel } from "@/components/contacts";
import { ProspectFinderButton } from "@/components/prospect-finder";

export default function PeoplePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Osoby</h2>
          <p className="mt-1 text-sm text-gray-600">
            Wszystkie osoby z wszystkich list. Znajdź nowe osoby filtrami (jak
            Lusha / Prospeo) i załaduj je do listy obserwowanej.
          </p>
        </div>
        <ProspectFinderButton defaultKind="person" />
      </div>
      <PeoplePanel />
    </div>
  );
}
