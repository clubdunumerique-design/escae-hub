import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Le middleware intercepte les requêtes pour rafraîchir la session Supabase
 * et protéger les routes qui nécessitent une authentification.
 */
export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // ── Interception des tokens Supabase arrivant sur la mauvaise page ──
  // Supabase ajoute ?code= (ou ?token_hash=) à la "Site URL" configurée dans
  // le dashboard, qui peut pointer vers "/" au lieu de "/auth/callback".
  // On détecte ce cas et on redirige immédiatement vers la route dédiée.
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  if ((code || tokenHash) && pathname !== "/auth/callback") {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    // Conserver tous les query params (code, token_hash, type, next…)
    return NextResponse.redirect(callbackUrl);
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabasePublicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabasePublicKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: getUser() valide le token JWT (plus sûr que getSession)
  const { data: { user } } = await supabase.auth.getUser();

  const isGuestOnlyRoute =
    request.nextUrl.pathname === "/auth/login" ||
    request.nextUrl.pathname === "/auth/register" ||
    request.nextUrl.pathname === "/auth/forgot-password";
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/projects") ||
    request.nextUrl.pathname.startsWith("/admin");

  if (isProtectedRoute && !user) {
    // Redirection vers la connexion si non authentifié
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // Bloquer les routes de projets côté serveur pour tous les rôles non étudiants.
  // Les Server Actions et RLS appliquent leurs propres contrôles indépendants.
  if (user && request.nextUrl.pathname.startsWith("/projects")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "student") {
      const url = request.nextUrl.clone();
      url.pathname = profile?.role === "admin" || profile?.role === "director"
        ? "/admin"
        : "/";
      return NextResponse.redirect(url);
    }
  }

  if (isGuestOnlyRoute && user) {
    // Redirection vers l'espace approprié selon le rôle
    let roleHomePath = "/dashboard";
    try {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profileData?.role === "admin" || profileData?.role === "director") {
        roleHomePath = "/admin";
      }
    } catch {
      // En cas d'erreur de lecture du profil, conserver /dashboard par défaut
    }
    const url = request.nextUrl.clone();
    url.pathname = roleHomePath;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
