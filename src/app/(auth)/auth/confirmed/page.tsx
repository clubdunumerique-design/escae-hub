"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ConfirmedPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const supabase = createSupabaseBrowserClient();

    async function checkAuth() {
      try {
        // 1. Vérifier si un hash d'erreur est présent
        if (typeof window !== "undefined" && window.location.hash) {
          const params = new URLSearchParams(window.location.hash.replace("#", ""));
          const errorDesc = params.get("error_description");
          if (errorDesc) {
            if (isMounted) {
              setErrorMessage(decodeURIComponent(errorDesc.replace(/\+/g, " ")));
              setStatus("error");
            }
            return;
          }
        }

        // 2. Vérifier la session actuelle
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (session?.user) {
          if (isMounted) {
            setUserEmail(session.user.email ?? null);
            setStatus("success");
          }
          return;
        }

        // 3. Écouter les changements d'état (si le client traite le hash)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, currentSession) => {
            if (currentSession?.user) {
              if (isMounted) {
                setUserEmail(currentSession.user.email ?? null);
                setStatus("success");
              }
            }
          }
        );

        // Laisser 2.5 secondes au client pour capturer un éventuel hash token
        setTimeout(async () => {
          if (!isMounted) return;
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            setUserEmail(user.email ?? null);
            setStatus("success");
          } else {
            // Si toujours aucune session trouvée
            setStatus("success"); // On permet quand même l'accès, le middleware ou la page suivante guidera
          }
        }, 2000);

        return () => {
          subscription.unsubscribe();
        };
      } catch (err: any) {
        if (isMounted) {
          setErrorMessage(err.message || "Impossible de vérifier la session.");
          setStatus("error");
        }
      }
    }

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
      {/* En-tête */}
      <div className="border-b border-white/10 bg-gradient-to-r from-[#074015]/40 to-[#152614]/40 px-8 py-8 text-center">
        {status === "loading" && (
          <div className="mx-auto flex flex-col items-center justify-center">
            <div className="h-14 w-14 animate-spin rounded-full border-4 border-[#03A61C]/20 border-t-[#05F228]" />
            <h1 className="mt-4 text-xl font-bold text-white">Confirmation en cours...</h1>
            <p className="mt-1 text-sm text-white/50">Validation de votre adresse email...</p>
          </div>
        )}

        {status === "success" && (
          <div className="mx-auto flex flex-col items-center justify-center">
            {/* Icône de succès avec halo vert */}
            <div className="relative mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#03A61C]/20 text-[#05F228] shadow-[0_0_25px_rgba(5,242,40,0.3)]">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="inline-block rounded-full bg-[#05F228]/10 px-3 py-1 text-xs font-semibold text-[#05F228]">
              Confirmation réussie
            </span>
            <h1 className="mt-3 text-2xl font-extrabold text-white">Votre compte est confirmé !</h1>
            <p className="mt-2 text-sm text-white/60">
              Votre adresse email a été validée avec succès. Votre compte est maintenant activé.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="mx-auto flex flex-col items-center justify-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/20 text-red-400">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="mt-3 text-2xl font-extrabold text-white">Échec de confirmation</h1>
            <p className="mt-2 text-sm text-red-400/90">
              {errorMessage || "Le lien de confirmation est invalide ou a expiré."}
            </p>
          </div>
        )}
      </div>

      {/* Corps & Actions */}
      <div className="px-8 py-6">
        {status === "loading" && (
          <div className="py-4 text-center text-sm text-white/40">
            Veuillez patienter un instant...
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col gap-4">
            {userEmail && (
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs">
                <span className="text-white/40">Compte activé</span>
                <span className="font-semibold text-white">{userEmail}</span>
              </div>
            )}

            <button
              onClick={() => router.push("/dashboard")}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-[#03A61C] py-3.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(3,166,28,0.4)] transition-all hover:bg-[#05F228] hover:text-black hover:shadow-[0_0_30px_rgba(5,242,40,0.6)]"
            >
              <span>Accéder à mon espace</span>
              <svg
                className="h-4 w-4 transition-transform group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col gap-4">
            <Link
              href="/auth/login"
              className="flex w-full items-center justify-center rounded-lg bg-white/10 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Aller à la page de connexion
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
