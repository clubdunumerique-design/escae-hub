import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Match a confirmed account with an explicitly verified registry record.
 * The database RPC checks university, matricule, identity, email and single claim.
 */
export async function claimCollectedMatricule(
  userId: string,
  universityId: unknown,
  matricule?: unknown,
) {
  if (typeof universityId !== "string" || !universityId.trim()) {
    return { matched: false, error: null };
  }
  const candidate =
    typeof matricule === "string" && matricule.trim().length > 0
      ? matricule.trim().toUpperCase()
      : null;

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("claim_student_matricule", {
      p_user_id: userId,
      p_university_id: universityId,
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
