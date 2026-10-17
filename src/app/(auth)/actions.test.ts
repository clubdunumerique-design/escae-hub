import { beforeEach, describe, expect, it, vi } from "vitest";

const { server, admin } = vi.hoisted(() => ({
  server: { auth: { getUser: vi.fn(), signUp: vi.fn() }, from: vi.fn() },
  admin: { rpc: vi.fn(), from: vi.fn() },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue(server),
  createSupabaseAdminClient: vi.fn().mockReturnValue(admin),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { completeAdminInvitationAction, registerAction } from "@/app/(auth)/actions";

describe("registerAction matricule rules", () => {
  it("refuse côté serveur les matricules qui ne respectent pas ETU-AAAA-NNNN", async () => {
    const form = new FormData();
    form.set("fullName", "Étudiant Test");
    form.set("email", "etudiant@example.test");
    form.set("studentId", "56008");
    form.set("password", "MotDePasse123");
    form.set("confirmPassword", "MotDePasse123");

    await expect(registerAction(form)).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining("ETU-AAAA-NNNN"),
    });
    expect(server.auth.signUp).not.toHaveBeenCalled();
  });
});

describe("completeAdminInvitationAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    server.auth.getUser.mockResolvedValue({
      data: {
        user: { id: "invitee-1", email: "admin@example.test", email_confirmed_at: "2026-01-01" },
      },
    });
    server.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi
          .fn()
          .mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { role: "admin" }, error: null }),
          }),
      }),
    });
    admin.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: { id: "appointment-1" }, error: null }),
            }),
          }),
        }),
      }),
    });
  });

  it("reports acceptance only when the server RPC accepts the confirmed account", async () => {
    admin.rpc.mockResolvedValue({ data: true, error: null });
    await expect(completeAdminInvitationAction()).resolves.toEqual({
      accepted: true,
      invitationPending: true,
      role: "admin",
    });
    expect(admin.rpc).toHaveBeenCalledWith("accept_admin_invitation", { p_user_id: "invitee-1" });
  });

  it("does not claim acceptance for expired, replayed, or missing invitations", async () => {
    admin.rpc.mockResolvedValue({ data: false, error: null });
    await expect(completeAdminInvitationAction()).resolves.toEqual({
      accepted: false,
      invitationPending: true,
      role: "admin",
    });
  });

  it("does not report an invitation when the account has no pending nomination", async () => {
    admin.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    });
    await expect(completeAdminInvitationAction()).resolves.toEqual({
      accepted: false,
      invitationPending: false,
      role: "admin",
    });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("does not call the privileged RPC before email confirmation", async () => {
    server.auth.getUser.mockResolvedValue({
      data: { user: { id: "invitee-1", email: "admin@example.test" } },
    });
    await expect(completeAdminInvitationAction()).resolves.toEqual({
      accepted: false,
      invitationPending: false,
      role: null,
    });
    expect(admin.rpc).not.toHaveBeenCalled();
  });
});
