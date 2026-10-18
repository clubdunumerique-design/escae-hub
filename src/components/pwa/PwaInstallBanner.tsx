"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // 1. Enregistrer le Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("[PWA] Erreur enregistrement Service Worker :", err);
      });
    }

    // 2. Vérifier si l'application est déjà lancée en mode autonome (PWA installée)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(isStandaloneMode);
      return isStandaloneMode;
    };

    if (checkStandalone()) {
      return;
    }

    // 3. Vérifier si l'utilisateur a fermé la bannière durant cette session
    const dismissedSession = sessionStorage.getItem("escae_pwa_dismissed");
    if (!dismissedSession) {
      setIsDismissed(false);
    }

    // 4. Détection iOS / Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // 5. Écouter l'événement standard d'installation Chrome / Android / Edge
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsDismissed(false);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
      setIsDismissed(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    if (!deferredPrompt) {
      // Si sur Android/navigateur sans prompt natif intercepté, afficher le guide d'installation
      setShowIosGuide(true);
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsDismissed(true);
      }
      setDeferredPrompt(null);
    } catch (error) {
      console.error("[PWA] Erreur déclenchement installation :", error);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem("escae_pwa_dismissed", "true");
    } catch {
      // Local storage indisponible en navigation privée
    }
  };

  // Ne pas afficher si déjà en mode application ou fermée
  if (isStandalone || isDismissed) {
    return null;
  }

  return (
    <>
      {/* Bannière en haut de l'écran */}
      <aside
        role="region"
        aria-label="Installation de l'application ESCAE Innovation Hub"
        className="sticky top-0 z-50 w-full border-b border-[#03A61C]/30 bg-[#0d140e]/95 px-3 py-2.5 backdrop-blur-md transition-all shadow-[0_4px_20px_rgba(3,166,28,0.15)]"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          {/* Logo + Textes */}
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/60 shadow-inner">
              <Image
                src="/icons/icon-192x192.png"
                alt="ESCAE Hub Icon"
                fill
                sizes="40px"
                className="object-cover"
                priority
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs sm:text-sm font-bold text-white">
                  ESCAE Innovation Hub
                </span>
                <span className="hidden sm:inline-block rounded-full bg-[#03A61C]/20 px-2 py-0.5 text-[10px] font-semibold text-[#05F228] border border-[#03A61C]/30">
                  App Mobile
                </span>
              </div>
              <p className="truncate text-[11px] sm:text-xs text-white/70">
                Installer l&apos;application sur votre mobile
              </p>
            </div>
          </div>

          {/* Boutons d'action */}
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              onClick={handleInstallClick}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#03A61C] to-[#05F228] px-3.5 py-1.5 text-xs font-bold text-black shadow-md shadow-[#03A61C]/30 transition hover:brightness-110 active:scale-95 cursor-pointer"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              <span>Installer</span>
            </button>

            <button
              onClick={handleDismiss}
              type="button"
              aria-label="Fermer la notification d'installation"
              className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Guide modal pour iOS et navigateurs sans prompt automatique */}
      {showIosGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121612] p-6 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="relative h-9 w-9 overflow-hidden rounded-lg border border-white/10">
                  <Image
                    src="/icons/icon-192x192.png"
                    alt="ESCAE Hub"
                    fill
                    sizes="36px"
                    className="object-cover"
                  />
                </div>
                <div>
                  <h3 id="pwa-guide-title" className="text-sm font-bold text-white">
                    Installer sur votre téléphone
                  </h3>
                  <p className="text-xs text-white/50">ESCAE-BÉNIN Innovation Hub</p>
                </div>
              </div>
              <button
                onClick={() => setShowIosGuide(false)}
                className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"
                aria-label="Fermer"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-5 space-y-4 text-xs sm:text-sm">
              <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#03A61C]/20 text-[#05F228] font-bold text-xs">
                  1
                </div>
                <div>
                  <p className="font-semibold text-white">
                    {isIos ? "Touchez le bouton de partage Safari" : "Ouvrez le menu de votre navigateur"}
                  </p>
                  <p className="mt-0.5 text-xs text-white/60">
                    {isIos ? "L'icône de partage carré avec une flèche vers le haut en bas de votre écran." : "Les 3 petits points verticaux en haut à droite."}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#03A61C]/20 text-[#05F228] font-bold text-xs">
                  2
                </div>
                <div>
                  <p className="font-semibold text-white">
                    Appuyez sur &laquo; Sur l&apos;écran d&apos;accueil &raquo;
                  </p>
                  <p className="mt-0.5 text-xs text-white/60">
                    Faites défiler la liste vers le bas jusqu&apos;à l&apos;option avec un symbole &laquo; + &raquo;.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#03A61C]/20 text-[#05F228] font-bold text-xs">
                  3
                </div>
                <div>
                  <p className="font-semibold text-white">Appuyez sur &laquo; Ajouter &raquo;</p>
                  <p className="mt-0.5 text-xs text-white/60">
                    L&apos;icône officielle apparaîtra directement sur votre écran d&apos;accueil comme une vraie application !
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowIosGuide(false)}
                type="button"
                className="w-full rounded-xl bg-white/10 py-2.5 text-xs font-semibold text-white transition hover:bg-white/15"
              >
                J&apos;ai compris
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
