"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AdminInvitationAcceptClient({
  appointmentId,
  token,
}: {
  appointmentId: string;
  token: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("Vérification de votre invitation…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function acceptInvitation() {
      try {
        if (!appointmentId || !token) {
          throw new Error("Le lien ne contient pas les informations de nomination. Demandez une nouvelle invitation au directeur.");
        }

        const supabase = createSupabaseBrowserClient();
        const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = fragment.get("access_token");
        const refreshToken = fragment.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) {
          throw new Error("La session e-mail n’a pas pu être établie. Rouvrez le dernier lien reçu.");
        }

        const { data: accepted, error: acceptanceError } = await supabase.rpc(
          "accept_admin_invitation",
          { p_appointment_id: appointmentId, p_token: token },
        );
        if (acceptanceError || accepted !== true) {
          throw new Error("Cette invitation ne correspond pas à ce compte, a expiré ou a déjà été utilisée. Demandez au directeur un nouveau lien par e-mail.");
        }

        // Remove the one-time token from the address bar after the atomic claim.
        window.history.replaceState(null, "", window.location.pathname);
        if (cancelled) return;

        const needsProfileSetup = userData.user.user_metadata?.admin_setup_required === true;
        setMessage("Nomination acceptée. Votre accès administrateur est activé.");
        router.replace(needsProfileSetup ? "/admin/profile/complete" : "/admin");
      } catch (cause) {
        if (cancelled) return;
        window.history.replaceState(null, "", window.location.pathname);
        setError(cause instanceof Error ? cause.message : "Impossible de valider cette invitation.");
      }
    }

    void acceptInvitation();
    return () => {
      cancelled = true;
    };
  }, [appointmentId, token, router]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <section className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Invitation administrateur</p>
        <h1 className="mt-3 text-2xl font-bold text-white">
          {error ? "Invitation non validée" : "Activation de votre accès"}
        </h1>
        <p className={`mt-4 leading-7 ${error ? "text-amber-200/80" : "text-white/65"}`} role={error ? "alert" : "status"}>
          {error ?? message}
        </p>
        {error && (
          <a href="/auth/login" className="mt-6 inline-flex rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15">
            Retour à la connexion
          </a>
        )}
      </section>
    </main>
  );
}
