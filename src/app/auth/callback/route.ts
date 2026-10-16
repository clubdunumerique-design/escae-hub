import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const error = searchParams.get("error");
  const error_description = searchParams.get("error_description");
  const next = searchParams.get("next") ?? "/auth/confirmed";

  // Si Supabase renvoie une erreur directe
  if (error) {
    const errorMsg = error_description || error;
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(errorMsg)}`, origin)
    );
  }

  // 1. Échange du code PKCE ou vérification token_hash (OTP email)
  if (code || (token_hash && type)) {
    const redirectUrl = new URL(next, origin);
    const response = NextResponse.redirect(redirectUrl);

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
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    let authenticated = false;

    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (!exchangeError) {
        authenticated = true;
      }
    } else if (token_hash && type) {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash,
        type: type as any,
      });
      if (!verifyError) {
        authenticated = true;
      }
    }

    if (authenticated) {
      // Déterminer la redirection optimale selon le rôle
      let destination = next;

      // Si type=invite ou si next pointe vers le confirmed par défaut, orienter vers admin
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

          if (profile?.role === "admin" || type === "invite") {
            destination = "/admin/profile/complete";
          } else if (profile?.role === "director") {
            destination = "/admin";
          }
        }
      } catch {
        // En cas d'erreur de lecture du profil, conserver 'next'
      }

      const finalRedirectUrl = new URL(destination, origin);
      const successResponse = NextResponse.redirect(finalRedirectUrl);

      // Copier les cookies vers la réponse finale
      response.cookies.getAll().forEach((c) => {
        successResponse.cookies.set(c.name, c.value);
      });

      return successResponse;
    }

    return NextResponse.redirect(
      new URL("/auth/login?error=Lien invalide ou expiré", origin)
    );
  }

  // 2. Si aucun paramètre n'a été transmis dans l'URL de requête (GET direct) :
  // Il est possible que le client ait reçu des hash fragments (#access_token=...)
  // Les fragments ne sont jamais envoyés au serveur HTTP. On renvoie donc une page HTML
  // de transition pour lire le hash côté client et rediriger vers /auth/confirmed.
  return new NextResponse(
    `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Vérification du compte...</title>
  </head>
  <body style="background:#0D0D0D;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
    <div style="text-align:center;">
      <p style="font-size:16px;">Vérification de votre compte...</p>
    </div>
    <script>
      if (window.location.hash && (window.location.hash.includes('access_token') || window.location.hash.includes('type='))) {
        window.location.href = '/auth/confirmed' + window.location.hash;
      } else {
        window.location.href = '/auth/login?error=' + encodeURIComponent('Lien de confirmation invalide ou expiré.');
      }
    </script>
  </body>
</html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    }
  );
}
