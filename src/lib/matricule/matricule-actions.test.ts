/**
 * Tests du module matricule-actions.ts
 *
 * Vérifie les règles métier de la collecte et de la vérification des matricules :
 * 1. Soumission publique : enregistrement avec statut 'pending'
 * 2. Rejet anti-bot via honeypot
 * 3. Validation des champs obligatoires (nom, prénom, matricule, email, filière)
 * 4. Détection et rejet des doublons de matricule
 * 5. Normalisation en majuscules du matricule
 * 6. Protection des actions staff (rejet des utilisateurs non autorisés ou anonymes)
 * 7. Approbation par un admin/directeur : statut 'verified' + mise à jour du profil si lié
 * 8. Rejet par un admin/directeur avec motif explicite
 * 9. Pré-enregistrement officiel par le staff
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockServerClient, mockAdminClient } = vi.hoisted(() => {
  const mockServerClient = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  };

  const mockAdminClient = {
    from: vi.fn(),
    rpc: vi.fn(),
  };

  return { mockServerClient, mockAdminClient };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue(mockServerClient),
  createSupabaseAdminClient: vi.fn().mockReturnValue(mockAdminClient),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: (name: string) => name === "x-real-ip" ? "192.0.2.10" : null,
  }),
}));
vi.mock("@/lib/notifications/send", () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
}));

import {
  submitStudentMatriculeAction,
  getMatriculeRegistryAction,
  approveMatriculeAction,
  rejectMatriculeAction,
  createOfficialMatriculeAction,
} from "./matricule-actions";

const VALID_UUID_1 = "550e8400-e29b-41d4-a716-446655440001";
const VALID_UUID_2 = "550e8400-e29b-41d4-a716-446655440002";

describe("Matricule Actions — Soumission et Vérification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "vitest-server-only-test-key";
    mockServerClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mockAdminClient.rpc.mockResolvedValue({ data: true, error: null });
  });

  // -------------------------------------------------------------------------
  // 1. Soumission publique
  // -------------------------------------------------------------------------
  describe("submitStudentMatriculeAction", () => {
    it("doit rejeter la soumission si le honeypot anti-bot est rempli", async () => {
      const result = await submitStudentMatriculeAction({
        firstName: "Jean",
        lastName: "Dupont",
        matricule: "ETU-2024-0001",
        email: "jean.dupont@gmail.com",
        fieldOfStudy: "Génie Logiciel",
        website: "http://spam-bot.com", // honeypot
      });

      expect(result.success).toBe(false);
      expect((result as any).error).toContain("spam");
    });

    it("doit rejeter si des champs obligatoires sont manquants ou invalides", async () => {
      const result = await submitStudentMatriculeAction({
        firstName: "",
        lastName: "",
        matricule: "",
        email: "invalide-email",
        fieldOfStudy: "",
      });

      expect(result.success).toBe(false);
      expect((result as any).error).toBeDefined();
    });

    it("doit refuser un matricule fantaisiste comme 56008 côté serveur", async () => {
      const result = await submitStudentMatriculeAction({
        firstName: "Jean",
        lastName: "Dupont",
        matricule: "56008",
        email: "jean.dupont@gmail.com",
      });
      expect(result.success).toBe(false);
      expect((result as any).error).toContain("ETU-AAAA-NNNN");
      expect(mockAdminClient.rpc).not.toHaveBeenCalled();
    });

    it("doit refuser un matricule déjà existant dans le registre", async () => {
      // Mock de la requête SELECT pour trouver un doublon
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "student_matricule_registry") {
          return {
            select: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: VALID_UUID_1,
                    matricule: "ETU-2024-0001",
                    verification_status: "verified",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await submitStudentMatriculeAction({
        firstName: "Jean",
        lastName: "Dupont",
        matricule: "etu-2024-0001",
        email: "jean@gmail.com",
        fieldOfStudy: "Informatique",
      });

      expect(result.success).toBe(false);
      expect((result as any).error).toContain("déjà enregistré");
    });

    it("doit insérer avec succès une nouvelle fiche avec statut pending", async () => {
      let insertedData: any = null;

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "student_matricule_registry") {
          return {
            select: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
            insert: vi.fn().mockImplementation((payload: any) => {
              insertedData = payload;
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: VALID_UUID_1, ...payload },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await submitStudentMatriculeAction({
        firstName: "Awa",
        lastName: "Koffi",
        matricule: "etu-2024-0999",
        email: "awa.koffi@gmail.com",
        fieldOfStudy: "Marketing Digital",
        academicLevel: "Licence 2",
      });

      expect(result.success).toBe(true);
      expect(insertedData).toBeDefined();
      expect(insertedData.matricule).toBe("ETU-2024-0999"); // Normalisé en MAJUSCULES
      expect(insertedData.first_name).toBe("Awa");
      expect(insertedData.last_name).toBe("Koffi");
      expect(insertedData.full_name).toBe("Awa Koffi");
      expect(insertedData.verification_status).toBe("pending"); // Ne doit pas être vérifié auto !
      expect(insertedData.claimed_by_user_id).toBeNull();
      expect(mockAdminClient.from).not.toHaveBeenCalledWith("profiles");
    });

    it("tente le rapprochement pour un étudiant connecté qui renseigne sa fiche depuis le lien", async () => {
      mockServerClient.auth.getUser.mockResolvedValue({
        data: { user: { id: "student-1", email: "awa.koffi@gmail.com", email_confirmed_at: "2026-10-17T10:00:00Z" } },
        error: null,
      });
      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "student_matricule_registry") {
          return {
            select: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: VALID_UUID_1 }, error: null }),
              }),
            }),
          };
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      });

      const result = await submitStudentMatriculeAction({
        firstName: "Awa",
        lastName: "Koffi",
        matricule: "ETU-2026-0024",
        email: "awa.koffi@gmail.com",
      });

      expect(result.success).toBe(true);
      expect((result as any).data.isExistingUser).toBe(true);
      expect(mockAdminClient.rpc).toHaveBeenCalledWith("claim_student_matricule", {
        p_user_id: "student-1",
        p_matricule: "ETU-2026-0024",
      });
    });
  });

  // -------------------------------------------------------------------------
  // 2. Opérations Staff & Sécurité
  // -------------------------------------------------------------------------
  describe("Opérations Staff & Autorisations", () => {
    it("doit refuser l'accès au registre si l'utilisateur est non connecté", async () => {
      mockServerClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

      const result = await getMatriculeRegistryAction();
      expect(result.success).toBe(false);
      expect((result as any).error).toContain("Permissions insuffisantes");
    });

    it("doit refuser l'approbation si l'utilisateur est un simple étudiant", async () => {
      mockServerClient.auth.getUser.mockResolvedValue({
        data: { user: { id: "student-1", email: "student@escae.bj" } },
        error: null,
      });

      mockServerClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: "student", full_name: "Simple Etudiant" },
              error: null,
            }),
          }),
        }),
      });

      const result = await approveMatriculeAction(VALID_UUID_1);
      expect(result.success).toBe(false);
      expect((result as any).error).toContain("Permissions insuffisantes");
    });

    it("doit empêcher le staff de valider un matricule au format invalide", async () => {
      mockServerClient.auth.getUser.mockResolvedValue({
        data: { user: { id: "admin-1", email: "admin@escae.bj" } },
        error: null,
      });
      mockServerClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { role: "admin", full_name: "Admin" }, error: null }),
          }),
        }),
      });

      const update = vi.fn();
      mockAdminClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: VALID_UUID_1, matricule: "56008", full_name: "Test", email: "test@gmail.com", claimed_by_user_id: null },
              error: null,
            }),
          }),
        }),
        update,
      });

      const result = await approveMatriculeAction(VALID_UUID_1);
      expect(result.success).toBe(false);
      expect((result as any).error).toContain("ETU-AAAA-NNNN");
      expect(update).not.toHaveBeenCalled();
    });

    it("doit approuver le matricule et mettre à jour le profil étudiant lié si l'appelant est admin", async () => {
      mockServerClient.auth.getUser.mockResolvedValue({
        data: { user: { id: "admin-1", email: "admin@escae.bj" } },
        error: null,
      });

      mockServerClient.from.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: "admin", full_name: "Super Admin" },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      let updatedRegistryPayload: any = {};

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "student_matricule_registry") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: VALID_UUID_1,
                    matricule: "ETU-2024-0555",
                    full_name: "Adama Traore",
                    email: "adama@escae.bj",
                    claimed_by_user_id: "user-student-789",
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockImplementation((payload: any) => {
              updatedRegistryPayload = { ...updatedRegistryPayload, ...payload };
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              };
            }),
          };
        }
        if (table === "audit_logs") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      const result = await approveMatriculeAction(VALID_UUID_1);
      expect(result.success).toBe(true);
      expect(updatedRegistryPayload.verification_status).toBe("verified");
      expect(updatedRegistryPayload.verified_by).toBe("admin-1");
      expect(mockAdminClient.rpc).toHaveBeenCalledWith("claim_student_matricule", {
        p_user_id: "user-student-789",
        p_matricule: "ETU-2024-0555",
      });
    });

    it("doit rejeter le matricule avec un motif explicite", async () => {
      mockServerClient.auth.getUser.mockResolvedValue({
        data: { user: { id: "director-1", email: "director@escae.bj" } },
        error: null,
      });

      mockServerClient.from.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: "director", full_name: "Directeur ESCAE" },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      let updatedRegistryPayload: any = {};

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "student_matricule_registry") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: VALID_UUID_2,
                    matricule: "ESCAE-FAUX-001",
                    full_name: "Fraudeur",
                    email: "fraude@fake.com",
                    claimed_by_user_id: null,
                  },
                  error: null,
                }),
              }),
            }),
            update: vi.fn().mockImplementation((payload: any) => {
              updatedRegistryPayload = { ...updatedRegistryPayload, ...payload };
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              };
            }),
          };
        }
        if (table === "audit_logs") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      const result = await rejectMatriculeAction(VALID_UUID_2, "Matricule introuvable dans les archives académiques");
      expect(result.success).toBe(true);
      expect(updatedRegistryPayload.verification_status).toBe("rejected");
      expect(updatedRegistryPayload.rejection_reason).toBe("Matricule introuvable dans les archives académiques");
    });

    it("doit permettre au staff de pré-enregistrer un matricule officiel vérifié", async () => {
      mockServerClient.auth.getUser.mockResolvedValue({
        data: { user: { id: "admin-1", email: "admin@escae.bj" } },
        error: null,
      });

      mockServerClient.from.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: "admin", full_name: "Admin Scolarité" },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      let insertedOfficial: any = null;

      mockAdminClient.from.mockImplementation((table: string) => {
        if (table === "student_matricule_registry") {
          return {
            select: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
            insert: vi.fn().mockImplementation((payload: any) => {
              insertedOfficial = payload;
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: VALID_UUID_1, ...payload },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        if (table === "audit_logs") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      const result = await createOfficialMatriculeAction({
        firstName: "Marc",
        lastName: "Hounnou",
        matricule: "ETU-2024-0002",
        email: "marc.hounnou@escae.bj",
        fieldOfStudy: "Génie Informatique",
        is_pre_verified: true,
      });

      expect(result.success).toBe(true);
      expect(insertedOfficial.verification_status).toBe("verified");
      expect(insertedOfficial.verified_by).toBe("admin-1");
    });
  });
});
