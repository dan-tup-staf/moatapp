import type { Metadata } from "next";

import { AuthProvider } from "@/contexts/auth-context";

import "./globals.css";

export const metadata: Metadata = {
  title: "MOATAPP",
  description: "Prospecting + buying signals",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
