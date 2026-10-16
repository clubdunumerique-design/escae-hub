import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRpc, mockAdminClient } = vi.hoisted(() => {
  const mockRpc = vi.fn();
  return { mockRpc, mockAdminClient: { rpc: mockRpc } };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(() => mockAdminClient),
}));

import { claimCollectedMatricule } from "./auto-claim";

describe("correspondance automatique du matricule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepte une correspondance confirmée par la procédure de base", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });

    await expect(claimCollectedMatricule("user-1", "AB-1234")).resolves.toEqual({
      matched: true,
      error: null,
    });
    expect(mockRpc).toHaveBeenCalledWith("claim_student_matricule", {
      p_user_id: "user-1",
      p_matricule: "AB-1234",
    });
  });

  it.each([
    ["matricule inconnu", "AB-1234"],
    ["format invalide", "@@@"],
    ["fiche déjà réclamée", "AB-1234"],
    ["nom ou email différent", "AB-1234"],
    ["email non confirmé", "AB-1234"],
  ])("reste non vérifié si la base refuse le cas %s", async (_caseName, matricule) => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    await expect(claimCollectedMatricule("user-2", matricule)).resolves.toEqual({
      matched: false,
      error: null,
    });
  });

  it("échoue fermé si Supabase renvoie une erreur", async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error("database unavailable") });
    const result = await claimCollectedMatricule("user-3", "AB-1234");
    expect(result.matched).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("ne considère qu'un seul gagnant lors de deux réponses concurrentes", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });

    const results = await Promise.all([
      claimCollectedMatricule("user-4", "AB-1234"),
      claimCollectedMatricule("user-5", "AB-1234"),
    ]);
    expect(results.filter((result) => result.matched)).toHaveLength(1);
  });
});
