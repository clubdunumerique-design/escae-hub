import { describe, expect, it } from "vitest";
import { isAdminInvitationLink } from "@/lib/auth/admin-invitation-link";

describe("isAdminInvitationLink", () => {
  it("accepts invite links addressed to the admin completion callback", () => {
    expect(isAdminInvitationLink("invite", "/admin/profile/complete")).toBe(true);
  });

  it("accepts dedicated magic links for existing-account nominations", () => {
    expect(isAdminInvitationLink("magiclink", "/admin/profile/complete")).toBe(true);
  });

  it("accepts PKCE callbacks that omit the link type but retain the nomination destination", () => {
    expect(isAdminInvitationLink(null, "/admin/profile/complete")).toBe(true);
  });

  it("keeps legacy recovery invitations working only on the admin callback", () => {
    expect(isAdminInvitationLink("recovery", "/admin/profile/complete")).toBe(true);
    expect(isAdminInvitationLink("recovery", "/auth/reset-password")).toBe(false);
  });

  it("never accepts other link types or callback destinations as a nomination", () => {
    expect(isAdminInvitationLink("signup", "/admin/profile/complete")).toBe(false);
    expect(isAdminInvitationLink("magiclink", "/dashboard")).toBe(false);
  });
});
