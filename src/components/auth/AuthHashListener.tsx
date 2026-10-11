"use client";

import { useEffect } from "react";

/**
 * Composant client qui écoute les fragments d'URL (#access_token=..., #type=signup, etc.)
 * Si Supabase redirige vers la racine (Site URL) ou une autre page avec un hash token,
 * ce composant intercepte le fragment et redirige l'utilisateur vers la page de confirmation.
 */
export function AuthHashListener() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash;
    if (!hash) return;

    // Détection d'un token d'accès ou d'un flux d'authentification Supabase dans le hash
    if (
      hash.includes("access_token") ||
      hash.includes("type=signup") ||
      hash.includes("type=email_change")
    ) {
      if (!window.location.pathname.startsWith("/auth/confirmed")) {
        window.location.replace("/auth/confirmed" + hash);
      }
    } else if (hash.includes("type=recovery")) {
      if (!window.location.pathname.startsWith("/auth/reset-password")) {
        window.location.replace("/auth/reset-password" + hash);
      }
    }
  }, []);

  return null;
}
