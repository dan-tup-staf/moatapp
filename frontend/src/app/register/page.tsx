"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import { api, ApiError } from "@/lib/api-client";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry a call when the cold free-tier API returns a gateway error (502/503/504)
 * or the fetch fails at the network layer. These mean the request never reached
 * the app, so retrying is safe. 4xx (e.g. 409 email taken) is thrown immediately. */
async function withColdStartRetry<T>(
  fn: () => Promise<T>,
  onAttempt?: (n: number) => void,
): Promise<T> {
  const delays = [0, 2000, 4000, 7000];
  let lastErr: unknown;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await sleep(delays[i]);
    onAttempt?.(i);
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retriable =
        !(err instanceof ApiError) ||
        [502, 503, 504, 0].includes(err.status);
      if (!retriable) throw err;
    }
  }
  throw lastErr;
}

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Wake the free-tier API on mount so it's warm by the time the user submits.
  useEffect(() => {
    api.warmUp();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // The free-tier API may be cold (spun down) — the first request can hit a
      // 502/503 during spin-up or fail at the network layer. Retry those a few
      // times (safe: a gateway error means the app never processed the request).
      await withColdStartRetry(
        () => api.register({ email, password, name: name || undefined }),
        (n) => setError(n > 0 ? `Budzę serwer… (próba ${n + 1})` : null),
      );
      // Registration succeeded. Auto-login is best-effort — if it lags, send the
      // user to login rather than making it look like signup failed.
      try {
        const { access_token } = await withColdStartRetry(() =>
          api.login({ email, password }),
        );
        await login(access_token);
        router.push("/start");
      } catch {
        router.push("/login?registered=1");
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.detail
          : "Nie udało się połączyć z serwerem. Spróbuj ponownie za chwilę.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg bg-white p-8 shadow">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Załóż konto</h1>
          <p className="mt-1 text-sm text-gray-500">w MOATION</p>
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
