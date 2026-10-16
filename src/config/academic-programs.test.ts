import { describe, expect, it } from "vitest";
import { ESCAE_PROGRAM_CATEGORIES } from "@/config/academic-programs";

describe("ESCAE academic programs", () => {
  it("contains the 17 programs supplied by the institution", () => {
    const programs = ESCAE_PROGRAM_CATEGORIES.flatMap((category) => category.programs);

    expect(programs).toHaveLength(17);
    expect(new Set(programs).size).toBe(17);
    expect(programs).toEqual(
      expect.arrayContaining([
        "Analyses Biomédicales (ABM)",
        "Banque Finance Assurance (BFA)",
        "Communication d'Entreprise et Médias (CEM)",
        "Comptabilité Audit et Contrôle de Gestion (CACG)",
        "Droit (DRT)",
        "Génie Civil - Bâtiments et Travaux Publics (GC-BTP)",
        "Gestion de Projets et Organisations (GPO)",
        "Hôtellerie Restauration (HR)",
        "Intelligence Artificielle (IA)",
        "Management des Ressources Humaines (MRH)",
        "Marketing et Stratégie d'Entreprise (MSE)",
        "Planification et Développement Local (PDL)",
        "Qualité Hygiène et Sécurité (QHS)",
        "Sécurité des Réseaux et Systèmes (SRS)",
        "Systèmes Informatiques et Logiciel (SIL)",
        "Tourisme et Loisir (TOULO)",
        "Transport et Logistique (TLOG)",
      ]),
    );
  });
});
