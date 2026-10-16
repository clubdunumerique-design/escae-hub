"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  completeAdminInvitationAction,
  completeStudentMatriculeClaimAction,
} from "@/app/(auth)/actions";

export default function ConfirmedPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAdminInvitationFlow, setIsAdminInvitationFlow] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let isFinishingUser = false;
    const supabase = createSupabaseBrowserClient();
    const adminInvitationFlow =
      new URLSearchParams(window.location.search).get("flow") === "admin-invitation";
    setIsAdminInvitationFlow(adminInvitationFlow);

    async function loadRole(userId: string): Promise<string | null> {
      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .single();
        if (error) return null;
        if (profile?.role && isMounted) {
          setUserRole(profile.role);
        }
        return profile?.role ?? null;
      } catch {
        return null;
      }
    }

    async function checkAuth() {
      try {
        const finishAuthenticatedUser = async (user: {
          id: string;
          email?: string;
          email_confirmed_at?: string | null;
        }) => {
          if (isFinishingUser) return;
          isFinishingUser = true;
          await completeStudentMatriculeClaimAction();
          // The server callback has already accepted this invitation atomically.
          // Keep the old hash-link path working for invitations issued before it.
          const legacyInviteLink =
            !adminInvitationFlow && window.location.hash.includes("type=invite");
          const invitation = legacyInviteLink ? await completeAdminInvitationAction() : null;
          if (legacyInviteLink && !invitation?.accepted) {
            setErrorMessage(
              "Cette invitation est expirée, déjà utilisée ou ne correspond pas à ce compte. Demandez une nouvelle invitation au directeur.",
            );
            setStatus("error");
            return;
          }
          setUserEmail(user.email ?? null);
          const role = invitation?.accepted ? invitation.role : await loadRole(user.id);
          if (adminInvitationFlow && role !== "admin") {
            setErrorMessage(
              "Votre adresse a été confirmée, mais votre accès administrateur n’a pas pu être activé. Contactez le directeur.",
            );
            setStatus("error");
            return;
          }
          setStatus("success");
        };
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

          // Hosted Supabase can redirect an invitation straight to Site URL and
          // put the session in the URL fragment. Fragments never reach the
          // server, so persist the session here before accepting the invitation
          // through the authenticated server action.
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) throw error;
            if (data.session?.user) {
              await finishAuthenticatedUser(data.session.user);
              window.history.replaceState(
                null,
                "",
                window.location.pathname + window.location.search,
              );
              return;
            }
          }
        }

        // 2. Vérifier la session actuelle
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (session?.user) {
          if (isMounted) await finishAuthenticatedUser(session.user);
          return;
        }

        // 3. Écouter les changements d'état (si le client traite le hash)
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
          if (currentSession?.user) {
            if (isMounted) await finishAuthenticatedUser(currentSession.user);
          }
        });

        // Laisser 2.5 secondes au client pour capturer un éventuel hash token
        setTimeout(async () => {
          if (!isMounted) return;
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            await finishAuthenticatedUser(user);
          } else {
            // Aucune session trouvée après délai : c'est une erreur réelle
            setErrorMessage(
              "Votre session n'a pas pu être créée. Le lien est peut-être expiré ou déjà utilisé.",
            );
            setStatus("error");
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <span className="inline-block rounded-full bg-[#05F228]/10 px-3 py-1 text-xs font-semibold text-[#05F228]">
              Confirmation réussie
            </span>
            <h1 className="mt-3 text-2xl font-extrabold text-white">
              {isAdminInvitationFlow
                ? "Votre nomination est confirmée !"
                : "Votre compte est confirmé !"}
            </h1>
            <p className="mt-2 text-sm text-white/60">
              {isAdminInvitationFlow
                ? "Votre adresse email est vérifiée et votre accès administrateur est activé. Vous pouvez accéder à votre espace."
                : "Votre adresse email a été validée avec succès. Votre compte est maintenant activé."}
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="mx-auto flex flex-col items-center justify-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/20 text-red-400">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
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
              onClick={() => {
                if (userRole === "admin") {
                  router.push(isAdminInvitationFlow ? "/admin" : "/admin/profile/complete");
                } else if (userRole === "director") {
                  router.push("/admin");
                } else {
                  router.push("/dashboard");
                }
              }}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-[#03A61C] py-3.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(3,166,28,0.4)] transition-all hover:bg-[#05F228] hover:text-black hover:shadow-[0_0_30px_rgba(5,242,40,0.6)]"
            >
              <span>
                {userRole === "admin"
                  ? "Accéder à mon espace"
                  : userRole === "director"
                    ? "Accéder à l'espace Direction"
                    : "Accéder à mon espace"}
              </span>
              <svg
                className="h-4 w-4 transition-transform group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-300">
              <p className="font-semibold">Que faire si le lien est expiré ?</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-200/70">
                <li>Contactez le directeur pour qu&apos;il vous envoie une nouvelle invitation.</li>
                <li>Chaque lien est usage unique et expire après 24 heures.</li>
                <li>Assurez-vous d&apos;utiliser le dernier email reçu.</li>
              </ul>
            </div>
            <a
              href="/auth/login"
              className="flex w-full items-center justify-center rounded-lg bg-white/10 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Aller à la page de connexion
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
