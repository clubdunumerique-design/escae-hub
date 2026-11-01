const ADMIN_PROFILE_PATH = "/auth/admin-invitation-accept"

/**
 * The callback destination is the discriminator: Supabase can report a
 * different OTP type for new and existing accounts. The database RPC still
 * validates the appointment, one-time token, expiry, and authenticated email.
 */
export function isAdminInvitationLink(_type: string | null, next: string): boolean {
  try {
    const url = new URL(next, "https://local.invalid");
    return (
      url.pathname === ADMIN_PROFILE_PATH &&
      Boolean(url.searchParams.get("appointmentId")) &&
      Boolean(url.searchParams.get("token"))
    );
  } catch {
    return false;
  }
}
