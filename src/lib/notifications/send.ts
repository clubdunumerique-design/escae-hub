import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const supabase = await createSupabaseServerClient();
  
  await supabase.from("notifications").insert({
    user_id: userId,
    type,
    title,
    message,
    link_url: linkUrl || null,
  });
}
