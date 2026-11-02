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

  it("transmet au serveur le choix d'université avec le matricule", async () => {
    const universityId = "00000000-0000-4000-8000-000000000002";
    const query: any = {};
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.maybeSingle = vi.fn().mockResolvedValue({ data: { id: universityId }, error: null });
    admin.from.mockReturnValue(query);
    server.auth.signUp.mockResolvedValue({
      data: { user: { id: "student-2", email_confirmed_at: null } },
      error: null,
    });

    const form = new FormData();
    form.set("fullName", "Étudiant Porto Novo");
    form.set("email", "etudiant@example.test");
    form.set("studentId", "ETU-2026-0024");
    form.set("universityId", universityId);
    form.set("communityJoined", "yes");
    form.set("password", "MotDePasse123");
    form.set("confirmPassword", "MotDePasse123");

    await expect(registerAction(form)).resolves.toMatchObject({ success: true });
    expect(server.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: "etudiant@example.test",
      password: "MotDePasse123",
      options: expect.objectContaining({
        data: expect.objectContaining({
          student_id: "ETU-2026-0024",
          university_id: universityId,
        }),
      }),
    }));
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

  it("does not accept legacy confirmation without an appointment-bound token", async () => {
    await expect(completeAdminInvitationAction()).resolves.toEqual({
      accepted: false,
      invitationPending: false,
      role: "admin",
    });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("does not claim acceptance for expired, replayed, or missing invitations", async () => {
    admin.rpc.mockResolvedValue({ data: false, error: null });
    await expect(completeAdminInvitationAction()).resolves.toEqual({
      accepted: false,
      invitationPending: false,
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
