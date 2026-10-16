-- Migration: 20261016120000_student_matricule_registry.sql
-- Description: Registre officiel des matricules étudiants pour vérification préalable et liaison d'inscription
-- Module: ESCAE-BÉNIN Innovation Hub

-- ==============================================================================
-- 1. TYPE ÉNUMÉRÉ DES STATUTS DE VÉRIFICATION
-- ==============================================================================

DO $$ BEGIN
  CREATE TYPE matricule_verification_status AS ENUM (
    'pending',   -- Soumis, en attente de vérification par l'administration
    'verified',  -- Officiellement certifié et validé
    'rejected'   -- Rejeté (matricule invalide ou non concordant)
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ==============================================================================
-- 2. TABLE student_matricule_registry
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.student_matricule_registry (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name           TEXT        NOT NULL,
  last_name            TEXT        NOT NULL,
  full_name            TEXT        NOT NULL,
  matricule            TEXT        NOT NULL,
  email                TEXT        NOT NULL,
  field_of_study       TEXT,       -- Filière / formation
  academic_level       TEXT,       -- Niveau (Licence 1, 2, 3, Master 1, 2)
  verification_status  matricule_verification_status NOT NULL DEFAULT 'pending',
  rejection_reason     TEXT,
  -- Liaison avec le compte Auth/Profile si l'étudiant est inscrit sur Innovation Hub
  claimed_by_user_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  claimed_at           TIMESTAMPTZ,
  -- Métadonnées de validation administrative
  verified_by          UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at          TIMESTAMPTZ,
  submitted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. INDEX ET CONTRAINTES D'UNICITÉ
-- Contrainte stricte : un matricule ne peut figurer qu'une seule fois dans le registre
-- (comparaison insensible à la casse et aux espaces).
-- ==============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_registry_matricule_unique
  ON public.student_matricule_registry (UPPER(TRIM(matricule)));

CREATE INDEX IF NOT EXISTS idx_student_registry_email
  ON public.student_matricule_registry (LOWER(TRIM(email)));

CREATE INDEX IF NOT EXISTS idx_student_registry_status
  ON public.student_matricule_registry (verification_status);

CREATE INDEX IF NOT EXISTS idx_student_registry_claimed_by
  ON public.student_matricule_registry (claimed_by_user_id);

CREATE INDEX IF NOT EXISTS idx_student_registry_created_at
  ON public.student_matricule_registry (created_at DESC);

-- Trigger pour la mise à jour automatique de updated_at
DROP TRIGGER IF EXISTS handle_updated_at_matricule_registry ON public.student_matricule_registry;
CREATE TRIGGER handle_updated_at_matricule_registry
BEFORE UPDATE ON public.student_matricule_registry
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ==============================================================================
-- 4. POLITIQUES DE SÉCURITÉ RLS (ROW LEVEL SECURITY)
-- ==============================================================================

ALTER TABLE public.student_matricule_registry ENABLE ROW LEVEL SECURITY;

-- 4.1. Consultation restreinte : seuls le directeur et les administrateurs voient le registre
DROP POLICY IF EXISTS "staff_sees_student_registry" ON public.student_matricule_registry;
CREATE POLICY "staff_sees_student_registry"
ON public.student_matricule_registry FOR SELECT
USING (public.has_role('admin', 'director'));

-- 4.2. Modification restreinte : seuls le directeur et les administrateurs peuvent valider/rejeter
DROP POLICY IF EXISTS "staff_updates_student_registry" ON public.student_matricule_registry;
CREATE POLICY "staff_updates_student_registry"
ON public.student_matricule_registry FOR UPDATE
USING (public.has_role('admin', 'director'));

-- 4.3. Suppression réservée au directeur uniquement
DROP POLICY IF EXISTS "director_deletes_student_registry" ON public.student_matricule_registry;
CREATE POLICY "director_deletes_student_registry"
ON public.student_matricule_registry FOR DELETE
USING (public.has_role('director'));

-- Note de sécurité : Les insertions depuis le formulaire public et la liaison avec
-- le compte Auth s'effectuent exclusivement via les Server Actions Next.js (avec
-- vérification serveur et client de service) afin de contrôler le rate limiting,
-- l'intégrité des formats et d'interdire toute lecture publique des fiches.
