import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function sendNotification({
  userId,
  type,
  title,
  message,
  linkUrl,
}: {
  userId: string;
  type: string;
  title: string;
  message: string;
  linkUrl?: string;
}) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    message,
    link_url: linkUrl || null,
  });
  if (error) {
    console.error("sendNotification error:", error);
  }
}
