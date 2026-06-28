"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import { api, ApiError } from "@/lib/api-client";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.warmUp();
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("registered") === "1"
    ) {
      setNotice("Konto utworzone — zaloguj się.");
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // Retry through cold-start gateway errors / hangs. A cold free-tier API
      // can hold the connection open ~50-60s while it boots, so bound each
      // attempt with a timeout and span the retry budget across the cold start.
      const delays = [0, 2000, 4000, 8000, 12000, 16000];
      let token: string | null = null;
      let lastErr: unknown;
      for (let i = 0; i < delays.length && token === null; i++) {
        if (delays[i]) await sleep(delays[i]);
        if (i > 0) setNotice(`Budzę serwer… (próba ${i + 1})`);
        try {
          token = (await api.login({ email, password }, 25000)).access_token;
        } catch (err) {
          lastErr = err;
          const retriable =
            !(err instanceof ApiError) ||
            [502, 503, 504, 0].includes(err.status);
          if (!retriable) throw err;
        }
      }
      setNotice(null);
      if (token === null) throw lastErr;
      await login(token);
      router.push("/start");
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Błąd logowania");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg bg-white p-8 shadow">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Zaloguj się</h1>
          <p className="mt-1 text-sm text-gray-500">do MOATION</p>
        </div>

        {notice && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {notice}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="block text-sm font-medium text-gray-700">Hasło</label>
            <input
              type="password"
              required
              autoComplete="current-password"
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
            {submitting ? "Logowanie..." : "Zaloguj"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          Nie masz konta?{" "}
          <Link href="/register" className="font-medium text-gray-900 hover:underline">
            Zarejestruj się
          </Link>
        </p>
      </div>
    </main>
  );
}
