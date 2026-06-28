"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Theme = "light" | "dark";
export type Locale = "pl" | "en";

type PreferencesContextType = {
  theme: Theme;
  locale: Locale;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  setLocale: (l: Locale) => void;
};

const PreferencesContext = createContext<PreferencesContextType | null>(null);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [locale, setLocaleState] = useState<Locale>("pl");

  // Hydrate from localStorage on mount.
  useEffect(() => {
    try {
      const t = (localStorage.getItem("moation_theme") as Theme) || "light";
      const l = (localStorage.getItem("moation_locale") as Locale) || "pl";
      setThemeState(t);
      setLocaleState(l);
      applyTheme(t);
      document.documentElement.lang = l;
    } catch {
      /* SSR / no storage */
    }
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    try {
      localStorage.setItem("moation_theme", t);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem("moation_theme", next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    document.documentElement.lang = l;
    try {
      localStorage.setItem("moation_locale", l);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <PreferencesContext.Provider
      value={{ theme, locale, toggleTheme, setTheme, setLocale }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextType {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return ctx;
}
