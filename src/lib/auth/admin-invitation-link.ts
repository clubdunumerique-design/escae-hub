const ADMIN_PROFILE_PATH = "/admin/profile/complete";

/**
 * Invitation links are bound to the admin-completion callback. Recovery links
 * are accepted here only for compatibility with invitations sent before the
 * dedicated Magic Link flow was deployed.
 */
export function isAdminInvitationLink(type: string | null, next: string): boolean {
  // The nomination flow sets this exact local callback destination. Some PKCE
  // callbacks omit `type`, so the destination is the stable discriminator.
  return (
    next === ADMIN_PROFILE_PATH &&
    (type === null || type === "invite" || type === "magiclink" || type === "recovery")
  );
}
