"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import { api, ApiError } from "@/lib/api-client";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.register({ email, password, name: name || undefined });
      // Auto-login po rejestracji
      const { access_token } = await api.login({ email, password });
      await login(access_token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd rejestracji");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg bg-white p-8 shadow">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Załóż konto</h1>
          <p className="mt-1 text-sm text-gray-500">w MOATAPP</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Imię <span className="text-gray-400">(opcjonalnie)</span>
            </label>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Hasło <span className="text-gray-400">(min. 8 znaków)</span>
            </label>
            <input
              type="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {submitting ? "Tworzenie konta..." : "Załóż konto"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          Masz już konto?{" "}
          <Link href="/login" className="font-medium text-gray-900 hover:underline">
            Zaloguj się
          </Link>
        </p>
      </div>
    </main>
  );
}
