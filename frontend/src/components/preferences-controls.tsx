"use client";

import { Moon, Sun } from "lucide-react";

import { usePreferences } from "@/contexts/preferences-context";
import { useT } from "@/lib/i18n";

/** Language switch (PL/EN) + dark-mode toggle for the top bar. */
export function PreferencesControls() {
  const { theme, locale, toggleTheme, setLocale } = usePreferences();
  const t = useT();

  return (
    <div className="flex items-center gap-2">
      {/* Language */}
      <div className="flex items-center rounded-md border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-gray-800">
        {(["pl", "en"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLocale(l)}
            title={t("Język")}
            className={
              "rounded px-2 py-1 text-xs font-semibold uppercase transition " +
              (locale === l
                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100")
            }
          >
            {l}
          </button>
        ))}
      </div>

      {/* Theme */}
      <button
        onClick={toggleTheme}
        title={theme === "dark" ? t("Tryb jasny") : t("Tryb nocny")}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
