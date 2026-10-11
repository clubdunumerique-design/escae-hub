/**
 * Client Supabase côté serveur (Server Components, Server Actions, Route Handlers).
 *
 * Gère les cookies de session via next/headers.
 * NE PAS importer dans les composants client.
 */
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabasePublicKey) {
    throw new Error(
      "Les variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ou NEXT_PUBLIC_SUPABASE_ANON_KEY) sont requises.",
    );
  }

  return createServerClient(supabaseUrl, supabasePublicKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // setAll peut être appelé depuis un Server Component en lecture seule.
          // Ignoré intentionnellement — le middleware gère le rafraîchissement de session.
        }
      },
    },
  });
}

/**
 * Client Supabase avec clé secrète serveur (sb_secret_... ou service_role) — contourne les RLS.
 *
 * ATTENTION : À utiliser UNIQUEMENT dans les opérations administratives
 * côté serveur après vérification explicite des permissions.
 * Ne jamais exposer dans le navigateur.
 */
export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) est requis pour le client admin. " +
        "Ne jamais exposer cette clé côté navigateur.",
    );
  }

  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
