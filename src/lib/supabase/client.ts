/**
 * Client Supabase côté navigateur (composants Client).
 *
 * Utilise la clé ANON publique — les politiques RLS protègent les données.
 * À utiliser uniquement dans les composants marqués "use client".
 */
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabasePublicKey) {
    throw new Error(
      "Les variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ou NEXT_PUBLIC_SUPABASE_ANON_KEY) sont requises. " +
        "Vérifiez votre fichier .env.local.",
    );
  }

  return createBrowserClient(supabaseUrl, supabasePublicKey);
}
