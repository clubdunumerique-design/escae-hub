import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { claimCollectedMatricule } from "@/lib/matricule/auto-claim";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const error = searchParams.get("error");
  const error_description = searchParams.get("error_description");
  const requestedNext = searchParams.get("next") ?? "/auth/confirmed";
  // N'accepter qu'un chemin local pour éviter les redirections externes après connexion.
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") && !requestedNext.includes("\\")
    ? requestedNext
    : "/auth/confirmed";

  // Si Supabase renvoie une erreur directe
  if (error) {
    const errorMsg = error_description || error;
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(errorMsg)}`, origin)
    );
  }

  // 1. Échange du code PKCE ou vérification token_hash (OTP email)
  if (code || (token_hash && type)) {
    const response = NextResponse.redirect(new URL(next, origin));

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

    let exchangeSucceeded = false;

    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (!exchangeError) {
        exchangeSucceeded = true;
      }
    } else if (token_hash && type) {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash,
        type: type as any,
      });
      if (!verifyError) {
        exchangeSucceeded = true;
      }
    }

    if (exchangeSucceeded) {
      // L'échange du code seul ne suffit pas : valider la session côté serveur.
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        if (type === "invite" || type === "recovery") {
          const admin = (await import("@/lib/supabase/server")).createSupabaseAdminClient();
          const { data: invitationAccepted, error: invitationError } = await admin.rpc(
            "accept_admin_invitation",
            { p_user_id: user.id },
          );
          if (invitationError || invitationAccepted !== true) {
            await supabase.auth.signOut();
            response.headers.set("Location", new URL(
              `/auth/login?error=${encodeURIComponent("Cette invitation est expirée, déjà utilisée ou ne correspond pas à ce compte. Demandez une nouvelle invitation au directeur.")}`,
              origin,
            ).toString());
            return response;
          }
        }

        // The database procedure independently checks email confirmation and performs
        // the claim atomically. Failures leave the account active but unverified.
        if (user.email_confirmed_at && user.user_metadata?.student_id) {
          await claimCollectedMatricule(user.id, user.user_metadata.student_id);
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        if (!profileError && profile?.role) {
          const destination = profile.role === "admin"
            ? "/admin/profile/complete"
            : profile.role === "director"
              ? "/admin"
              : "/dashboard";

          // Conserver la même réponse qui a reçu les cookies Supabase, sans en perdre les options.
          response.headers.set("Location", new URL(destination, origin).toString());
          return response;
        }
      }
    }

    // Lien invalide ou expiré : message explicite
    const errParam = type === "invite"
      ? "Lien d'invitation expiré ou déjà utilisé. Contactez le directeur pour une nouvelle invitation."
      : "Lien de confirmation invalide ou expiré. Veuillez réessayer depuis votre email.";
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(errParam)}`, origin)
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
