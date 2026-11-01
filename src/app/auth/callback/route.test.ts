import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/auth/callback/route";

describe("GET /auth/callback hash fallback", () => {
  it("preserves the appointment callback and one-time token destination", async () => {
    const invitationNext = "/auth/admin-invitation-accept?appointmentId=appointment-1&token=one-time-token";
    const request = new NextRequest(
      `https://hub.example.test/auth/callback?next=${encodeURIComponent(invitationNext)}`,
    );

    const response = await GET(request);
    const html = await response.text();

    expect(html).toContain(`window.location.replace(${JSON.stringify(invitationNext).replace(/[<>&]/g, (character) => ({ "<": "\\u003c", ">": "\\u003e", "&": "\\u0026" })[character]!)} + window.location.hash)`);
  });

  it("keeps normal email confirmations on the confirmation page", async () => {
    const request = new NextRequest(
      "https://hub.example.test/auth/callback?next=%2Fauth%2Fconfirmed",
    );

    const response = await GET(request);
    const html = await response.text();

    expect(html).toContain('window.location.replace("/auth/confirmed" + window.location.hash)');
  });
});
