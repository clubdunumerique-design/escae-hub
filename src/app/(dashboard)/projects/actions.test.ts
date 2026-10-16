import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockClient, mockFrom, mockSelect, mockEq, mockSingle, mockCreateSingle, mockUpdateEq, mockRpc } = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockCreateSingle = vi.fn();
  const mockUpdateEq = vi.fn();
  const mockRpc = vi.fn();
  const mockEq = vi.fn(() => ({ single: mockSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn();
  const mockClient = {
    auth: { getUser: vi.fn() },
    from: mockFrom,
    rpc: mockRpc,
  };
  return { mockClient, mockFrom, mockSelect, mockEq, mockSingle, mockCreateSingle, mockUpdateEq, mockRpc };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue(mockClient),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createProjectAction, submitProjectAction } from "./actions";

describe("permissions étudiant sur les projets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: true, error: null });
    mockClient.auth.getUser.mockResolvedValue({ data: { user: { id: "student-user" } } });
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") return { select: mockSelect };
      if (table === "projects") {
        return {
          select: mockSelect,
          insert: vi.fn(() => ({ select: vi.fn(() => ({ single: mockCreateSingle })) })),
          update: vi.fn(() => ({ eq: mockUpdateEq })),
        };
      }
      if (table === "status_history") return { insert: vi.fn().mockResolvedValue({ error: null }) };
      return {};
    });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
  });

  it.each(["admin", "director"]) (
    "%s ne peut pas créer un projet via l'action serveur",
    async (role) => {
      mockSingle.mockResolvedValue({ data: { role, is_verified: true }, error: null });

      const result = await createProjectAction(new FormData());

      expect(result).toMatchObject({ success: false, code: "FORBIDDEN" });
      expect(mockFrom).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith("profiles");
    },
  );

  it("refuse la soumission sans session", async () => {
    mockClient.auth.getUser.mockResolvedValue({ data: { user: null } });
    await expect(submitProjectAction("project-1")).resolves.toMatchObject({
      success: false,
      code: "UNAUTHORIZED",
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it.each(["admin", "director"]) (
    "%s ne peut pas soumettre un projet via l'action serveur",
    async (role) => {
      mockSingle.mockResolvedValue({ data: { role, is_verified: true }, error: null });

      const result = await submitProjectAction("project-1");

      expect(result).toMatchObject({ success: false, code: "FORBIDDEN" });
      expect(mockFrom).toHaveBeenCalledTimes(1);
      expect(mockFrom).toHaveBeenCalledWith("profiles");
    },
  );

  it("autorise un étudiant non vérifié à créer un brouillon", async () => {
    mockSingle.mockResolvedValue({ data: { role: "student", is_verified: false }, error: null });
    mockCreateSingle.mockResolvedValue({ data: { id: "project-1" }, error: null });
    const formData = new FormData();
    formData.set("title", "Projet étudiant de démonstration");
    formData.set("description", "Une description suffisamment détaillée pour passer la validation.");
    formData.set("objectives", "Développer une solution utile.");
    formData.set("problem", "Répondre à un problème local concret.");
    formData.set("solution", "Créer un service numérique accessible.");
    formData.set("feasibility", "Le projet est réalisable par une équipe étudiante.");
    formData.set("impact", "Améliorer le service rendu aux étudiants.");
    formData.set("budget", "0");

    await expect(createProjectAction(formData)).resolves.toMatchObject({ success: true });
  });

  it("refuse une création invalide avant l'insertion", async () => {
    mockSingle.mockResolvedValue({ data: { role: "student", is_verified: false }, error: null });
    const result = await createProjectAction(new FormData());
    expect(result).toMatchObject({ success: false, code: "VALIDATION_ERROR" });
    expect(mockCreateSingle).not.toHaveBeenCalled();
  });

  it("autorise un étudiant non vérifié à soumettre son propre brouillon", async () => {
    mockSingle.mockResolvedValue({ data: { role: "student", is_verified: false }, error: null });

    await expect(submitProjectAction("project-1")).resolves.toMatchObject({ success: true });
    expect(mockRpc).toHaveBeenCalledWith("transition_project_status", expect.objectContaining({
      p_project_id: "project-1",
      p_expected_status: "draft",
      p_new_status: "submitted",
    }));
  });

  it("autorise également un étudiant vérifié à soumettre", async () => {
    mockSingle.mockResolvedValue({ data: { role: "student", is_verified: true }, error: null });
    await expect(submitProjectAction("project-verified")).resolves.toMatchObject({ success: true });
  });

  it("refuse une deuxième soumission ou un projet inaccessible", async () => {
    mockSingle.mockResolvedValue({ data: { role: "student", is_verified: false }, error: null });
    mockRpc.mockResolvedValue({ data: false, error: null });
    await expect(submitProjectAction("other-project")).resolves.toMatchObject({ success: false });
  });

  it("retourne une erreur compréhensible si la base échoue pendant la transition", async () => {
    mockSingle.mockResolvedValue({ data: { role: "student", is_verified: false }, error: null });
    mockRpc.mockResolvedValue({ data: null, error: new Error("database unavailable") });
    await expect(submitProjectAction("project-1")).resolves.toMatchObject({
      success: false,
      error: "La soumission n'a pas pu être enregistrée. Veuillez réessayer.",
    });
  });
});
