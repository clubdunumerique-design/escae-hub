import { describe, expect, it } from "vitest";
import { isAdminInvitationLink } from "@/lib/auth/admin-invitation-link";

describe("isAdminInvitationLink", () => {
  const invitationNext = "/auth/admin-invitation-accept?appointmentId=appt-1&token=secret";

  it("accepts only the appointment-bound invitation callback", () => {
    expect(isAdminInvitationLink("invite", invitationNext)).toBe(true);
  });

  it("accepts dedicated magic links for existing-account nominations", () => {
    expect(isAdminInvitationLink("magiclink", invitationNext)).toBe(true);
  });

  it("accepts PKCE callbacks that omit the link type but retain the nomination destination", () => {
    expect(isAdminInvitationLink(null, invitationNext)).toBe(true);
  });

  it("supports recovery links only when bound to an appointment token", () => {
    expect(isAdminInvitationLink("recovery", invitationNext)).toBe(true);
    expect(isAdminInvitationLink("recovery", "/auth/reset-password")).toBe(false);
  });

  it("never accepts other link types or callback destinations as a nomination", () => {
    expect(isAdminInvitationLink("signup", invitationNext)).toBe(false);
    expect(isAdminInvitationLink("magiclink", "/dashboard")).toBe(false);
  });
});
