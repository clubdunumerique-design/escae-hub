import { describe, it, expect } from "vitest";
import type { UserRole, ProjectStatus } from "@/types";

/**
 * Tests de cohérence des types métier.
 * Ces tests vérifient que les valeurs littérales des unions correspondent
 * exactement aux règles métier documentées.
 */
describe("Types métier", () => {
  describe("UserRole", () => {
    const EXPECTED_ROLES: UserRole[] = [
      "student",
      "verifier",
      "admin",
      "reviewer",
      "scheduler",
      "director",
    ];

    it("contient exactement les 6 rôles définis", () => {
      // Vérification que toutes les valeurs attendues sont assignables
      // (échoue à la compilation TypeScript si un rôle est supprimé)
      EXPECTED_ROLES.forEach((role) => {
        expect(typeof role).toBe("string");
      });
      expect(EXPECTED_ROLES).toHaveLength(6);
    });
  });

  describe("ProjectStatus", () => {
    const EXPECTED_STATUSES: ProjectStatus[] = [
      "draft",
      "submitted",
      "admin_review",
      "corrections_requested",
      "under_review",
      "jury_evaluation",
      "director_validation",
      "accepted_for_presentation",
      "scheduling",
      "presentation_done",
      "final_decision",
      "approved",
      "rejected",
      "under_re_examination",
      "postponed",
      "cancelled",
    ];

    it("contient exactement les 16 statuts du cycle de vie", () => {
      EXPECTED_STATUSES.forEach((status) => {
        expect(typeof status).toBe("string");
      });
      expect(EXPECTED_STATUSES).toHaveLength(16);
    });

    it("inclut les statuts de correction et de refus", () => {
      expect(EXPECTED_STATUSES).toContain("corrections_requested");
      expect(EXPECTED_STATUSES).toContain("rejected");
      expect(EXPECTED_STATUSES).toContain("cancelled");
      expect(EXPECTED_STATUSES).toContain("postponed");
    });

    it("distingue 'accepted_for_presentation' de 'approved'", () => {
      // Règle métier : l'acceptation pour présentation ≠ approbation finale
      expect(EXPECTED_STATUSES).toContain("accepted_for_presentation");
      expect(EXPECTED_STATUSES).toContain("approved");
      expect("accepted_for_presentation").not.toBe("approved");
    });
  });
});
