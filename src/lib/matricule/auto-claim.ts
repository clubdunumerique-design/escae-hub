import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Match a confirmed account with its previously collected record.
 * `is_verified` means a confirmed email and a match with collected data;
 * it does not certify official school identity.
 */
export async function claimCollectedMatricule(userId: string, matricule?: unknown) {
  const candidate =
    typeof matricule === "string" && matricule.trim().length > 0
      ? matricule.trim().toUpperCase()
      : null;

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("claim_student_matricule", {
      p_user_id: userId,
      p_matricule: candidate,
    });

    if (error) {
      console.error("[matricule] Échec de la tentative de correspondance automatique.");
      return { matched: false, error };
    }

    return { matched: data === true, error: null };
  } catch (error) {
    console.error("[matricule] Service de correspondance indisponible.");
    return { matched: false, error };
  }
}
