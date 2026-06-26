"use client";

import { ListsPanel } from "@/components/contacts";

export default function ListsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Listy</h2>
        <p className="mt-1 text-sm text-gray-600">
          Kolekcje prospektów do outreachu
        </p>
      </div>
      <ListsPanel />
    </div>
  );
}
