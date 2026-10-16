import { beforeEach, describe, expect, it, vi } from "vitest";

const { client } = vi.hoisted(() => ({
  client: { auth: { getUser: vi.fn() }, from: vi.fn(), rpc: vi.fn() },
}));

vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn().mockResolvedValue(client) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updateProjectStatusAction } from "./actions";

describe("updateProjectStatusAction permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.auth.getUser.mockResolvedValue({ data: { user: { id: "student-1" } } });
    client.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { role: "student" }, error: null }) }),
      }),
    });
  });

  it("refuse une transition demandée par un étudiant avant tout accès en écriture", async () => {
    await expect(updateProjectStatusAction("project-1", "admin_review")).resolves.toMatchObject({
      success: false,
      code: "FORBIDDEN",
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
