"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuth } from "@/contexts/auth-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Ładowanie...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <h1 className="text-lg font-bold tracking-tight">MOATAPP</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{user.email}</span>
            <button
              onClick={logout}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100"
            >
              Wyloguj
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
