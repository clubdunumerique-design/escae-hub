"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function markNotificationAsReadAction(notificationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: "Erreur lors de la mise à jour." };

  revalidatePath("/dashboard");
  return { success: true };
}

export async function markAllNotificationsAsReadAction() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Non autorisé" };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) return { success: false, error: "Erreur lors de la mise à jour." };

  revalidatePath("/dashboard");
  return { success: true };
}
