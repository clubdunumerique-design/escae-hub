"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ApiResponse } from "@/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const projectMessageSchema = z.object({
  projectId: z.string().uuid(),
  body: z.string().trim().min(1, "Écrivez un message.").max(3000, "Le message est trop long."),
});

export async function createProjectMessageAction(
  projectId: string,
  body: string,
): Promise<ApiResponse<void>> {
  const parsed = projectMessageSchema.safeParse({ projectId, body });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Message invalide." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Connectez-vous pour écrire dans cet échange." };

  const { error } = await supabase.from("project_messages").insert({
    project_id: parsed.data.projectId,
    author_id: user.id,
    body: parsed.data.body,
  });

  if (error) {
    console.error("createProjectMessageAction error:", error);
    return { success: false, error: "Message non envoyé. Vérifiez vos droits sur ce projet et réessayez." };
  }

  revalidatePath(`/projects/${parsed.data.projectId}`);
  revalidatePath(`/admin/projects/${parsed.data.projectId}`);
  return { success: true, data: undefined };
}
