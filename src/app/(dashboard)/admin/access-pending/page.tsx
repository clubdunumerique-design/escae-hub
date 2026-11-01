import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveAccessRole } from "@/lib/auth/resolve-access-role";
import { logoutAction } from "@/app/(auth)/actions";

export const dynamic = "force-dynamic";

export default async function AdminAccessPendingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [{ data: profile }, { data: effectiveRole }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    supabase.rpc("effective_user_role"),
  ]);
  const accessRole = resolveAccessRole(profile?.role, effectiveRole);

  if (accessRole === "admin" || accessRole === "director") redirect("/admin");
  if (accessRole !== "inactive_admin") redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-[65vh] max-w-2xl items-center px-4 py-12">
      <section className="w-full rounded-2xl border border-amber-400/20 bg-white/[0.03] p-8 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Compte administrateur</p>
        <h1 className="mt-3 text-2xl font-bold text-white">Votre accès administrateur n’est pas encore actif</h1>
        <p className="mt-4 leading-7 text-white/65">
          L’acceptation du lien personnel active automatiquement l’accès défini par la direction. Aucun périmètre accepté et actif n’est actuellement associé à ce compte.
        </p>
        <p className="mt-3 text-sm text-white/45">
          Si vous avez déjà ouvert le lien reçu, demandez au directeur de renvoyer l’invitation par e-mail et ouvrez le nouveau lien avec la même adresse que votre compte. Vous n’avez pas besoin de créer un autre compte.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <a href="/auth/login" className="inline-flex rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15">
            Retour à la connexion
          </a>
          <form action={logoutAction}>
            <button type="submit" className="inline-flex rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/5">
              Se déconnecter
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
