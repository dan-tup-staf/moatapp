import type { Metadata } from "next";

import { AuthProvider } from "@/contexts/auth-context";
import { PreferencesProvider } from "@/contexts/preferences-context";

import "./globals.css";

export const metadata: Metadata = {
  title: "MOATION",
  description: "Prospecting + buying signals",
};

// Apply the saved theme before paint to avoid a flash of the wrong theme.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('moation_theme');if(t==='dark')document.documentElement.classList.add('dark');var l=localStorage.getItem('moation_locale');if(l)document.documentElement.lang=l;}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <PreferencesProvider>
          <AuthProvider>{children}</AuthProvider>
        </PreferencesProvider>
      </body>
    </html>
  );
}
