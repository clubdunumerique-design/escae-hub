import { AdminInvitationAcceptClient } from "@/components/auth/AdminInvitationAcceptClient";

export const dynamic = "force-dynamic";

export default async function AdminInvitationAcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ appointmentId?: string; token?: string }>;
}) {
  const params = await searchParams;
  return (
    <AdminInvitationAcceptClient
      appointmentId={params.appointmentId ?? ""}
      token={params.token ?? ""}
    />
  );
}
