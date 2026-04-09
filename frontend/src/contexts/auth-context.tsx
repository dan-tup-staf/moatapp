"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { api, UserRead } from "@/lib/api-client";
import { tokenStorage } from "@/lib/auth";

type AuthContextType = {
  user: UserRead | null;
  loading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserRead | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: if token exists, hydrate user from /me
  useEffect(() => {
    const token = tokenStorage.get();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .me(token)
      .then(setUser)
      .catch(() => {
        // token invalid/expired — clear it
        tokenStorage.clear();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (token: string) => {
    tokenStorage.set(token);
    const u = await api.me(token);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
