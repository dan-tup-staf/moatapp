"use client";

import { KeyRound, Loader2, UserCog } from "lucide-react";
import { useEffect, useState } from "react";

import { useAuth } from "@/contexts/auth-context";
import { api, ApiError } from "@/lib/api-client";

export default function AccountProfilePage() {
  const { user, refresh: refreshAuth } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setEmail(user.email);
    }
  }, [user]);

  async function saveProfile() {
    setSavingProfile(true);
    setProfileMsg(null);
    setProfileErr(null);
    try {
      await api.account.updateProfile({ name: name.trim() || null, email });
      setProfileMsg("Zapisano zmiany profilu.");
      await refreshAuth?.();
    } catch (e) {
      setProfileErr(e instanceof ApiError ? e.detail : "Błąd zapisu");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword() {
    setPwMsg(null);
    setPwErr(null);
    if (newPw.length < 8) {
      setPwErr("Nowe hasło musi mieć min. 8 znaków.");
      return;
    }
    if (newPw !== newPw2) {
      setPwErr("Hasła nie są identyczne.");
      return;
    }
    setSavingPw(true);
    try {
      await api.account.changePassword({
        current_password: curPw,
        new_password: newPw,
      });
      setPwMsg("Hasło zmienione.");
      setCurPw("");
      setNewPw("");
      setNewPw2("");
    } catch (e) {
      setPwErr(e instanceof ApiError ? e.detail : "Błąd zmiany hasła");
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profil i konto</h1>
        <p className="mt-1 text-sm text-gray-500">
          Zarządzaj swoimi danymi i hasłem.
        </p>
      </div>

      {/* Profile */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <UserCog className="h-4 w-4 text-indigo-600" /> Dane profilu
        </h2>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Imię i nazwisko
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Daniel Tupczyński"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              E-mail (login)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          {profileErr && <p className="text-sm text-red-600">{profileErr}</p>}
          {profileMsg && (
            <p className="text-sm text-emerald-700">{profileMsg}</p>
          )}
          <button
            onClick={saveProfile}
            disabled={savingProfile}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
            Zapisz profil
          </button>
        </div>
      </section>

      {/* Password */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <KeyRound className="h-4 w-4 text-indigo-600" /> Zmiana hasła
        </h2>
        <div className="mt-4 space-y-3">
          <input
            type="password"
            value={curPw}
            onChange={(e) => setCurPw(e.target.value)}
            placeholder="Obecne hasło"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="Nowe hasło (min. 8 znaków)"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={newPw2}
            onChange={(e) => setNewPw2(e.target.value)}
            placeholder="Powtórz nowe hasło"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {pwErr && <p className="text-sm text-red-600">{pwErr}</p>}
          {pwMsg && <p className="text-sm text-emerald-700">{pwMsg}</p>}
          <button
            onClick={savePassword}
            disabled={savingPw || !curPw || !newPw}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {savingPw && <Loader2 className="h-4 w-4 animate-spin" />}
            Zmień hasło
          </button>
        </div>
      </section>
    </div>
  );
}
