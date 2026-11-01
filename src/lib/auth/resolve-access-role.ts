export type AccessRole = "student" | "admin" | "director" | "inactive_admin";

/**
 * Resolve navigation from the database-computed role. A stored admin profile
 * without a valid mandate is deliberately treated as inactive, never as a
 * student and never as an authorized administrator.
 */
export function resolveAccessRole(
  profileRole: string | null | undefined,
  effectiveRole: string | null | undefined,
): AccessRole | null {
  if (
    effectiveRole === "student" ||
    effectiveRole === "admin" ||
    effectiveRole === "director" ||
    effectiveRole === "inactive_admin"
  ) {
    return effectiveRole;
  }

  if (profileRole === "admin") return "inactive_admin";
  if (profileRole === "director") return "director";
  if (profileRole === "student") return "student";
  return null;
}

export function accessRoleHome(role: AccessRole | null): string {
  if (role === "admin" || role === "director") return "/admin";
  if (role === "inactive_admin") return "/admin/access-pending";
  return "/dashboard";
}
