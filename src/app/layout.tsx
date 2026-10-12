import { Inter } from "next/font/google";
import "./globals.css";
import { APP_CONFIG } from "@/config/app.config";
import type { Metadata, Viewport } from "next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0D0D0D",
};

export const metadata: Metadata = {
  title: {
    default: APP_CONFIG.name,
    template: `%s — ${APP_CONFIG.shortName}`,
  },
  description: APP_CONFIG.description,
  robots: {
    // La plateforme est privée — ne pas indexer
    index: false,
    follow: false,
  },
  // [PROVISOIRE] Les métadonnées Open Graph seront complétées
  // une fois le logo et les couleurs officielles confirmés
};

import { Suspense } from "react";
import { AuthHashListener } from "@/components/auth/AuthHashListener";
import { RouteProgressBar } from "@/components/layout/RouteProgressBar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={inter.variable}>
      <body>
        <Suspense fallback={null}>
          <RouteProgressBar />
        </Suspense>
        <AuthHashListener />
        {children}
      </body>
    </html>
  );
}
