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

  it("accepts the appointment callback even when Supabase returns signup", () => {
    expect(isAdminInvitationLink("signup", invitationNext)).toBe(true);
    expect(isAdminInvitationLink("email", invitationNext)).toBe(true);
  });

  it("requires both appointment and token and rejects other callback destinations", () => {
    expect(isAdminInvitationLink("magiclink", "/auth/admin-invitation-accept?appointmentId=appt-1")).toBe(false);
    expect(isAdminInvitationLink("magiclink", "/auth/admin-invitation-accept?token=secret")).toBe(false);
    expect(isAdminInvitationLink("magiclink", "/dashboard")).toBe(false);
    expect(isAdminInvitationLink("magiclink", "/auth/admin-invitation-accept/extra?appointmentId=appt-1&token=secret")).toBe(false);
  });
});
