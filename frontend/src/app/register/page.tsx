"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import { api, ApiError } from "@/lib/api-client";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Bound each attempt so a hung cold-start request (Render holds the connection
// open for ~50-60s while the container boots) is aborted and retried instead of
// blocking the form forever.
const ATTEMPT_TIMEOUT_MS = 25000;

/** Retry a call when the cold free-tier API returns a gateway error (502/503/504),
 * times out, or fails at the network layer — these mean the app didn't process
 * the request (or we couldn't confirm it did), so retrying is safe. The retry
 * budget spans a realistic ~60s cold start. 4xx (e.g. 409 email taken) throws
 * immediately. `fn` receives the per-attempt timeout to apply to its request. */
async function withColdStartRetry<T>(
  fn: (timeoutMs: number) => Promise<T>,
  onAttempt?: (n: number) => void,
): Promise<T> {
  const delays = [0, 2000, 4000, 8000, 12000, 16000];
  let lastErr: unknown;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await sleep(delays[i]);
    onAttempt?.(i);
    try {
      return await fn(ATTEMPT_TIMEOUT_MS);
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
    const onAttempt = (n: number) =>
      setError(n > 0 ? `Budzę serwer… (próba ${n + 1})` : null);
    try {
      // The free-tier API may be cold (spun down) — the first request can hang,
      // hit a 502/503 during spin-up, or fail at the network layer. Retry those
      // (a gateway/timeout error means we couldn't confirm the app processed it).
      let registered = true;
      try {
        await withColdStartRetry(
          (t) => api.register({ email, password, name: name || undefined }, t),
          onAttempt,
        );
      } catch (err) {
        // A retried signup can re-send a registration the server already
        // committed, yielding a 409 even though the account WAS created. Don't
        // fail outright: fall through to login and let it disambiguate — a 409
        // for a genuinely taken email will surface as a 401 there.
        if (err instanceof ApiError && err.status === 409) {
          registered = false;
        } else {
          throw err;
        }
      }

      // Auto-login. Doubles as the 409 check above: success means the account is
      // ours; a 401 after a 409 means the email really belongs to someone else.
      try {
        const { access_token } = await withColdStartRetry(
          (t) => api.login({ email, password }, t),
          onAttempt,
        );
        await login(access_token);
        router.push("/start");
      } catch (loginErr) {
        if (
          !registered &&
          loginErr instanceof ApiError &&
          loginErr.status === 401
        ) {
          setError("Konto z tym adresem e-mail już istnieje — zaloguj się.");
          return;
        }
        // Account exists but auto-login lagged — send to login rather than
        // making it look like signup failed.
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
