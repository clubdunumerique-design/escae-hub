/**
 * Configuration de l'application ESCAE-BÉNIN Innovation Hub.
 *
 * Les valeurs marquées [PROVISOIRE] sont des placeholders documentés.
 * Elles devront être confirmées avec les parties prenantes avant la mise en production.
 */

// --- Identité de la plateforme ---
export const APP_CONFIG = {
  name: "ESCAE-BÉNIN Innovation Hub",
  shortName: "ESCAE Hub",
  // [PROVISOIRE] Description — à valider avec l'administration
  description: "Plateforme de soumission et d'évaluation de projets étudiants — ESCAE-BÉNIN",
  version: "0.1.0",
  // [PROVISOIRE] URL canonique — à définir lors du déploiement
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;

// --- Stockage Supabase ---
export const STORAGE_CONFIG = {
  // Bucket pour les documents de projets (privé)
  projectDocumentsBucket: "project_documents",
  // Bucket pour les pitch decks (privé)
  pitchDecksBucket: "pitch-decks",
  // Taille maximale de fichier autorisée : 10 Mo (harmonisé avec le formulaire)
  maxFileSizeBytes: 10 * 1024 * 1024,
  // Types MIME acceptés pour les documents
  acceptedMimeTypes: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
  ],
} as const;

// --- Pagination ---
export const PAGINATION_CONFIG = {
  defaultPageSize: 20,
  maxPageSize: 100,
} as const;

// --- Évaluation [PROVISOIRE] ---
// [PROVISOIRE] Critères et pondérations — À confirmer avec le jury
// Ne pas utiliser ces valeurs comme officielles en production
export const EVALUATION_CONFIG_PROVISIONAL = {
  criteria: [
    { id: "innovation", label: "Innovation", weight: 0.25 },
    { id: "feasibility", label: "Faisabilité", weight: 0.25 },
    { id: "impact", label: "Impact social/économique", weight: 0.25 },
    { id: "presentation", label: "Qualité de présentation", weight: 0.25 },
  ],
  // [PROVISOIRE] Score minimal pour acceptation — À confirmer avec la direction
  minPassScore: 60,
  maxScore: 100,
} as const;

// --- Fonctionnalités désactivées (non encore implémentées) ---
// Ces flags permettent de signaler clairement les fonctionnalités en développement
export const FEATURE_FLAGS = {
  emailNotifications: false,  // Activé au Module 8
  pdfExport: false,           // Activé au Module 8
  juryEvaluation: false,      // Activé au Module 5
  scheduling: false,          // Activé au Module 7
} as const;
