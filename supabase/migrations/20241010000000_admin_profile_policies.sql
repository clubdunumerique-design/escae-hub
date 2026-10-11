-- Migration: 20241010000000_admin_profile_policies
-- Description: Permet aux admins et verificateurs de mettre a jour les profils etudiants
-- Notamment le champ is_verified pour la verification manuelle des inscriptions
-- Reversible: oui (voir section DOWN)

-- ==============================================================================
-- UP
-- ==============================================================================

-- Politique permettant aux roles admin/verifier/director de mettre a jour
-- les profils (notamment le champ is_verified)
CREATE POLICY "Le personnel autorise met a jour les profils"
ON public.profiles FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'verifier', 'director')
  )
);

-- ==============================================================================
-- DOWN (pour annuler cette migration)
-- ==============================================================================
-- DROP POLICY IF EXISTS "Le personnel autorise met a jour les profils" ON public.profiles;

