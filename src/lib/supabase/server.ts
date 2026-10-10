/**
 * Client Supabase côté serveur (Server Components, Server Actions, Route Handlers).
 *
 * Gère les cookies de session via next/headers.
 * NE PAS importer dans les composants client.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Les variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sont requises.",
    );
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
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
 * Client Supabase avec clé service_role — contourne les RLS.
 *
 * ATTENTION : À utiliser UNIQUEMENT dans les opérations administratives
 * côté serveur après vérification explicite des permissions.
 * Ne jamais exposer dans le navigateur.
 */
export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY est requis pour le client admin. " +
        "Ne jamais exposer cette clé côté navigateur.",
    );
  }

  // Import dynamique pour éviter le bundling côté client
  const { createClient } = require("@supabase/supabase-js");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
