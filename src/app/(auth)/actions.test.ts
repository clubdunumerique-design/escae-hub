import { beforeEach, describe, expect, it, vi } from "vitest";

const { server, admin } = vi.hoisted(() => ({
  server: { auth: { getUser: vi.fn() }, from: vi.fn() },
  admin: { rpc: vi.fn() },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue(server),
  createSupabaseAdminClient: vi.fn().mockReturnValue(admin),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { completeAdminInvitationAction } from "@/app/(auth)/actions";

describe("completeAdminInvitationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.auth.getUser.mockResolvedValue({
      data: { user: { id: "invitee-1", email: "admin@example.test", email_confirmed_at: "2026-01-01" } },
    });
    server.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { role: "admin" }, error: null }) }),
      }),
    });
  });

  it("reports acceptance only when the server RPC accepts the confirmed account", async () => {
    admin.rpc.mockResolvedValue({ data: true, error: null });
    await expect(completeAdminInvitationAction()).resolves.toEqual({ accepted: true, role: "admin" });
    expect(admin.rpc).toHaveBeenCalledWith("accept_admin_invitation", { p_user_id: "invitee-1" });
  });

  it("does not claim acceptance for expired, replayed, or missing invitations", async () => {
    admin.rpc.mockResolvedValue({ data: false, error: null });
    await expect(completeAdminInvitationAction()).resolves.toEqual({ accepted: false, role: "admin" });
  });

  it("does not call the privileged RPC before email confirmation", async () => {
    server.auth.getUser.mockResolvedValue({ data: { user: { id: "invitee-1", email: "admin@example.test" } } });
    await expect(completeAdminInvitationAction()).resolves.toEqual({ accepted: false, role: null });
    expect(admin.rpc).not.toHaveBeenCalled();
  });
});
