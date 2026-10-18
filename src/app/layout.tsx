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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_CONFIG.shortName,
  },
  robots: {
    // La plateforme est privée — ne pas indexer
    index: false,
    follow: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icons/icon-192x192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

import { Suspense } from "react";
import { AuthHashListener } from "@/components/auth/AuthHashListener";
import { RouteProgressBar } from "@/components/layout/RouteProgressBar";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { PwaInstallBanner } from "@/components/pwa/PwaInstallBanner";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem("escae-theme") || "dark";
                document.documentElement.setAttribute("data-theme", t);
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <PwaInstallBanner />
          <Suspense fallback={null}>
            <RouteProgressBar />
          </Suspense>
          <AuthHashListener />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
