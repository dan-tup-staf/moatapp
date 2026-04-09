"use client";

import { useAuth } from "@/contexts/auth-context";

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="mt-1 text-sm text-gray-600">
          Witaj, {user.name || user.email}!
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-medium text-gray-500">Twój profil</h3>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="font-medium text-gray-700">ID:</dt>
            <dd className="text-gray-900">{user.id}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-gray-700">Email:</dt>
            <dd className="text-gray-900">{user.email}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-gray-700">Imię:</dt>
            <dd className="text-gray-900">{user.name || "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium text-gray-700">Konto utworzone:</dt>
            <dd className="text-gray-900">
              {new Date(user.created_at).toLocaleString("pl-PL")}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6">
        <h3 className="text-sm font-medium text-gray-500">Wkrótce</h3>
        <ul className="mt-2 space-y-1 text-sm text-gray-600">
          <li>• Listy leadów + import CSV</li>
          <li>• Kampanie i sekwencje mailowe</li>
          <li>• Sygnały zakupowe (intent data)</li>
        </ul>
      </div>
    </div>
  );
}
