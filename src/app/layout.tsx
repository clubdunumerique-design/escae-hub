import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { APP_CONFIG } from "@/config/app.config";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
