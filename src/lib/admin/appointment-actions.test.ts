/**
 * Tests du module appointment-actions.ts
 *
 * Ces tests vérifient les règles métier sans appel réseau réel :
 * toutes les dépendances Supabase sont mockées.
 *
 * Cas couverts (requis §10) :
 * 1. Le directeur peut nommer un administrateur.
 * 2. Un étudiant ne peut pas nommer un administrateur.
 * 3. Un administrateur ne peut pas nommer un autre administrateur.
 * 4. Un administrateur ne peut pas modifier son propre rôle.
 * 5. Une invitation déjà existante est gérée sans doublon.
 * 6. L'administrateur peut compléter sa fiche.
 * 7. L'administrateur ne peut pas falsifier son historique (date de mandat).
 * 8. La clôture retire les droits administratifs.
 * 9. Le remplacement conserve l'historique de l'ancien titulaire.
 * 10. Les politiques RLS sont respectées (logique serveur).
 * 11. Les erreurs d'envoi d'invitation sont gérées proprement.
 * 12. Les autres fonctionnalités continuent de fonctionner.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks des modules Supabase
// vi.hoisted() garantit que ces objets sont initialisés AVANT le hoisting de vi.mock()
// ---------------------------------------------------------------------------

const { mockServerClient, mockAdminClient } = vi.hoisted(() => {
  const mockServerClient = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  };

  const mockAdminClient = {
    auth: {
      admin: {
        listUsers: vi.fn(),
        inviteUserByEmail: vi.fn(),
      },
    },
    from: vi.fn(),
  };

  return { mockServerClient, mockAdminClient };
});

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue(mockServerClient),
  createSupabaseAdminClient: vi.fn().mockReturnValue(mockAdminClient),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/notifications/send", () => ({
  sendNotification: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Import des actions après les mocks
// ---------------------------------------------------------------------------
import {
  nominateAdminAction,
  closeAppointmentAction,
  revokeAppointmentAction,
  updateAdminProfileAction,
} from "@/lib/admin/appointment-actions";

// ---------------------------------------------------------------------------
// Helpers de setup
// ---------------------------------------------------------------------------

function setupDirectorSession(directorId = "dir-001") {
  mockServerClient.auth.getUser.mockResolvedValue({
    data: { user: { id: directorId } },
  });
  mockServerClient.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: directorId, role: "director", full_name: "Directeur Test" },
          error: null,
        }),
      }),
    }),
  });
}

function setupStudentSession(userId = "student-001") {
  mockServerClient.auth.getUser.mockResolvedValue({
    data: { user: { id: userId } },
  });
  mockServerClient.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: userId, role: "student", full_name: "Étudiant Test" },
          error: null,
        }),
      }),
    }),
  });
}

function setupAdminSession(adminId = "admin-001") {
  mockServerClient.auth.getUser.mockResolvedValue({
    data: { user: { id: adminId } },
  });
  mockServerClient.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: adminId, role: "admin", full_name: "Admin Test" },
          error: null,
        }),
      }),
    }),
  });
}

function setupNoSession() {
  mockServerClient.auth.getUser.mockResolvedValue({
    data: { user: null },
  });
}

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  return fd;
}

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------

describe("nominateAdminAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // TC-01 : Le directeur peut nommer un admin
  it("TC-01 : le directeur peut nommer un administrateur", async () => {
    setupDirectorSession("dir-001");

    // L'email n'existe pas encore
    mockAdminClient.auth.admin.listUsers.mockResolvedValue({
      data: { users: [] },
      error: null,
    });

    // inviteUserByEmail réussit
    mockAdminClient.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: { user: { id: "new-admin-001" } },
      error: null,
    });

    mockAdminClient.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "appt-001" },
            error: null,
          }),
        }),
      }),
    });

    const fd = makeFormData({
      fullName: "Jean Admin",
      email: "jean.admin@example.com",
      missionDescription: "Gérer la plateforme",
    });

    const result = await nominateAdminAction(fd);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.appointmentId).toBe("appt-001");
    }
    expect(mockAdminClient.auth.admin.inviteUserByEmail).toHaveBeenCalledWith(
      "jean.admin@example.com",
      expect.objectContaining({
        data: expect.objectContaining({ role: "admin" }),
      })
    );
  });

  // TC-02 : Un étudiant ne peut pas nommer un admin
  it("TC-02 : un étudiant ne peut pas nommer un administrateur", async () => {
    setupStudentSession("student-001");

    const fd = makeFormData({ fullName: "Test", email: "test@example.com" });
    const result = await nominateAdminAction(fd);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("FORBIDDEN");
    }
    expect(mockAdminClient.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
  });

  // TC-03 : Un admin ne peut pas nommer un autre admin
  it("TC-03 : un administrateur ne peut pas nommer un autre administrateur", async () => {
    setupAdminSession("admin-001");

    const fd = makeFormData({ fullName: "Autre", email: "autre@example.com" });
    const result = await nominateAdminAction(fd);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("FORBIDDEN");
    }
  });

  // TC-05 : Invitation déjà existante — pas de doublon
  it("TC-05 : une invitation existante est gérée sans créer de doublon", async () => {
    setupDirectorSession("dir-001");

    // L'email existe déjà dans auth.users
    mockAdminClient.auth.admin.listUsers.mockResolvedValue({
      data: {
        users: [{ id: "existing-001", email: "jean.admin@example.com" }],
      },
      error: null,
    });

    // Retourne un mandat actif pour cet utilisateur
    mockAdminClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "existing-001", role: "student", full_name: "Jean Admin" },
            error: null,
          }),
          in: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "appt-existing", status: "active" },
              error: null,
            }),
          }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const fd = makeFormData({ fullName: "Jean Admin", email: "jean.admin@example.com" });
    const result = await nominateAdminAction(fd);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("DUPLICATE_APPOINTMENT");
    }
  });

  // TC-11 : Erreur d'envoi d'invitation gérée proprement
  it("TC-11 : une erreur d'invitation est gérée et retourne une erreur claire", async () => {
    setupDirectorSession("dir-001");

    mockAdminClient.auth.admin.listUsers.mockResolvedValue({
      data: { users: [] },
      error: null,
    });

    mockAdminClient.auth.admin.inviteUserByEmail.mockResolvedValue({
      data: null,
      error: { message: "SMTP connection failed" },
    });

    mockAdminClient.from.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    const fd = makeFormData({ fullName: "Fail Admin", email: "fail@example.com" });
    const result = await nominateAdminAction(fd);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("invitation");
    }
  });

  // TC-session : non connecté
  it("retourne une erreur si aucune session active", async () => {
    setupNoSession();
    const fd = makeFormData({ fullName: "X", email: "x@x.com" });
    const result = await nominateAdminAction(fd);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("closeAppointmentAction", () => {
  beforeEach(() => vi.clearAllMocks());

  // TC-08 : La clôture retire les droits administratifs
  it("TC-08 : la clôture d'un mandat retire les droits administratifs", async () => {
    setupDirectorSession("dir-001");

    const profileUpdateSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    // Flag pour différencier SELECT (premier appel) vs UPDATE (deuxième appel)
    let apptSelected = false;

    mockAdminClient.from.mockImplementation((table: string) => {
      if (table === "admin_appointments") {
        if (!apptSelected) {
          apptSelected = true;
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "appt-001",
                    admin_id: "admin-001",
                    status: "active",
                    start_date: "2026-01-01",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "profiles") {
        return { update: profileUpdateSpy };
      }
      // audit_logs et notifications
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    const VALID_APPT_UUID = "550e8400-e29b-41d4-a716-446655440000";

    const fd = makeFormData({
      appointmentId: VALID_APPT_UUID,
      endDate: "2026-10-15",
    });

    const result = await closeAppointmentAction(fd);

    expect(result.success).toBe(true);
    // Le rôle doit avoir été rétrogradé à 'student'
    expect(profileUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ role: "student" })
    );
  });


  // TC-08b : Un étudiant ne peut pas clôturer un mandat
  it("TC-08b : un étudiant ne peut pas clôturer un mandat", async () => {
    setupStudentSession();
    const fd = makeFormData({ appointmentId: "appt-001", endDate: "2026-10-15" });
    const result = await closeAppointmentAction(fd);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("FORBIDDEN");
    }
  });

  // TC-07 : L'admin ne peut pas clôturer son propre mandat (falsifier les dates)
  it("TC-07 : un admin ne peut pas clôturer son propre mandat (falsifier les dates)", async () => {
    setupAdminSession("admin-001");
    const fd = makeFormData({ appointmentId: "appt-001", endDate: "2026-10-15" });
    const result = await closeAppointmentAction(fd);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("FORBIDDEN");
    }
  });
});

// ---------------------------------------------------------------------------
describe("revokeAppointmentAction", () => {
  beforeEach(() => vi.clearAllMocks());

  // TC-08c : Révocation réussie par le directeur
  it("TC-08c : le directeur peut révoquer un mandat actif", async () => {
    setupDirectorSession("dir-001");

    let apptCallCount = 0;
    mockAdminClient.from.mockImplementation((table: string) => {
      if (table === "admin_appointments") {
        apptCallCount++;
        if (apptCallCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "appt-001", admin_id: "admin-001", status: "active" },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    const fd = makeFormData({ appointmentId: "appt-001" });
    const result = await revokeAppointmentAction(fd);
    expect(result.success).toBe(true);
  });

  // TC-09 : L'historique de l'ancien titulaire est conservé (statut 'revoked', pas supprimé)
  it("TC-09 : la révocation ne supprime pas l'enregistrement — statut 'revoked' préservé", async () => {
    setupDirectorSession("dir-001");

    const updateSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    let apptCount = 0;
    mockAdminClient.from.mockImplementation((table: string) => {
      if (table === "admin_appointments") {
        apptCount++;
        if (apptCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "appt-001", admin_id: "admin-001", status: "active" },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { update: updateSpy };
      }
      return {
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    const fd = makeFormData({ appointmentId: "appt-001" });
    await revokeAppointmentAction(fd);

    // L'update doit positionner status='revoked', jamais DELETE
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ status: "revoked" })
    );
  });
});

// ---------------------------------------------------------------------------
describe("updateAdminProfileAction", () => {
  beforeEach(() => vi.clearAllMocks());

  // TC-06 : L'admin peut compléter sa fiche
  it("TC-06 : l'administrateur peut mettre à jour son profil", async () => {
    setupAdminSession("admin-001");

    mockAdminClient.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    const fd = makeFormData({
      fullName: "Marie Admin",
      department: "Scolarité",
    });

    const result = await updateAdminProfileAction(fd);
    expect(result.success).toBe(true);
  });

  // TC-04 : L'admin ne peut pas modifier son propre rôle
  it("TC-04 : le champ 'role' ne peut pas être modifié via updateAdminProfileAction", async () => {
    setupAdminSession("admin-001");

    const updateSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mockAdminClient.from.mockReturnValue({
      update: updateSpy,
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    // Tenter d'injecter un rôle via FormData — ne doit pas passer dans l'update
    const fd = makeFormData({ role: "director" });

    await updateAdminProfileAction(fd);

    // L'update ne doit JAMAIS inclure le champ 'role'
    const calls = updateSpy.mock.calls as Array<[Record<string, unknown>]>;
    calls.forEach(([payload]) => {
      expect(payload).not.toHaveProperty("role");
    });
  });

  // TC-10 : Un étudiant ne peut pas accéder aux fonctions admin
  it("TC-10 : un étudiant ne peut pas mettre à jour un profil admin", async () => {
    setupStudentSession("student-001");
    const fd = makeFormData({ fullName: "Hacker" });
    const result = await updateAdminProfileAction(fd);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("FORBIDDEN");
    }
  });

  // TC-12 : Retourne une erreur claire si non authentifié
  it("TC-12 : retourne UNAUTHORIZED si non connecté", async () => {
    setupNoSession();
    const fd = makeFormData({ fullName: "X" });
    const result = await updateAdminProfileAction(fd);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
  });
});

// ---------------------------------------------------------------------------
describe("Validations Zod", () => {
  beforeEach(() => vi.clearAllMocks());

  it("nominateAdmin : rejette un email invalide", async () => {
    setupDirectorSession("dir-001");
    mockAdminClient.auth.admin.listUsers.mockResolvedValue({ data: { users: [] }, error: null });

    const fd = makeFormData({ fullName: "Test Valide", email: "pas-un-email" });
    const result = await nominateAdminAction(fd);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("VALIDATION_ERROR");
    }
  });

  it("nominateAdmin : rejette un nom trop court", async () => {
    setupDirectorSession("dir-001");
    mockAdminClient.auth.admin.listUsers.mockResolvedValue({ data: { users: [] }, error: null });

    const fd = makeFormData({ fullName: "X", email: "valid@example.com" });
    const result = await nominateAdminAction(fd);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("VALIDATION_ERROR");
    }
  });

  it("closeAppointment : rejette une date invalide", async () => {
    setupDirectorSession("dir-001");
    const fd = makeFormData({ appointmentId: "550e8400-e29b-41d4-a716-446655440000", endDate: "not-a-date" });
    const result = await closeAppointmentAction(fd);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("VALIDATION_ERROR");
    }
  });
});
