-- Migration: 20261015180000_admin_appointments_and_audit
-- Description: Système de nomination des administrateurs avec historique et journal d'activité
-- Auteur: IA (mission d'implémentation)
-- Réversible: oui (voir section DOWN en commentaire)

-- ==============================================================================
-- 1. TABLE admin_appointments — historique des nominations
-- ==============================================================================

CREATE TYPE appointment_status AS ENUM (
  'pending_acceptance', -- invitation envoyée, en attente d'acceptation
  'active',             -- administrateur en fonction
  'ended',              -- fonction clôturée normalement
  'revoked'             -- droits révoqués par le directeur
);

CREATE TABLE public.admin_appointments (
  id                 UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  appointed_by       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status             appointment_status NOT NULL DEFAULT 'pending_acceptance',
  mission_description TEXT,
  -- Dates de fonction (distinctes de l'invitation)
  start_date         DATE,       -- date réelle de prise de fonction (confirmée par l'admin ou le directeur)
  end_date           DATE,       -- date réelle de fin de fonction
  -- Métadonnées
  invitation_sent_at TIMESTAMPTZ,
  invitation_accepted_at TIMESTAMPTZ,
  revocation_reason  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contrainte : un seul enregistrement actif ou pending par administrateur à la fois
-- (un admin ne peut avoir qu'un seul mandat non-clôturé simultanément)
CREATE UNIQUE INDEX idx_admin_appointments_unique_active
  ON public.admin_appointments (admin_id)
  WHERE status IN ('pending_acceptance', 'active');

-- Contrainte applicative : au plus un admin 'active' dans toute la table
-- Implémentée via une fonction trigger pour être atomique
CREATE OR REPLACE FUNCTION public.enforce_single_active_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- Si on tente de mettre un appointment à 'active'
  IF NEW.status = 'active' THEN
    -- Vérifier qu'aucun autre n'est actif (sauf si c'est le même enregistrement mis à jour)
    IF EXISTS (
      SELECT 1 FROM public.admin_appointments
      WHERE status = 'active'
        AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Un seul administrateur peut être en fonction simultanément. Clôturez le mandat en cours avant d''en ouvrir un nouveau.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_single_active_admin
BEFORE INSERT OR UPDATE ON public.admin_appointments
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_active_admin();

-- Trigger updated_at
CREATE TRIGGER handle_updated_at_admin_appointments
BEFORE UPDATE ON public.admin_appointments
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ==============================================================================
-- 2. TABLE audit_logs — journal d'activité immuable
-- ==============================================================================

CREATE TABLE public.audit_logs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id    UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL, -- ex: 'admin.nominated', 'admin.invitation_sent', 'admin.role_revoked', etc.
  target_id   UUID,                 -- identifiant de l'objet concerné (appointment, profile, etc.)
  target_type TEXT,                 -- type de l'objet : 'admin_appointment', 'profile', etc.
  details     JSONB,                -- données contextuelles (sans secrets)
  ip_address  INET,                 -- adresse IP de la requête (optionnelle)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Pas de updated_at : les logs sont immuables
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_audit_logs_actor_id   ON public.audit_logs (actor_id);
CREATE INDEX idx_audit_logs_action     ON public.audit_logs (action);
CREATE INDEX idx_audit_logs_target_id  ON public.audit_logs (target_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs (created_at DESC);

-- ==============================================================================
-- 3. SÉCURITÉ RLS
-- ==============================================================================

ALTER TABLE public.admin_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs         ENABLE ROW LEVEL SECURITY;

-- --- admin_appointments ---

-- Le directeur voit tous les mandats
CREATE POLICY "director_sees_all_appointments"
ON public.admin_appointments FOR SELECT
USING (public.has_role('director'));

-- L'administrateur voit son propre mandat
CREATE POLICY "admin_sees_own_appointment"
ON public.admin_appointments FOR SELECT
USING (
  admin_id = auth.uid()
  AND public.has_role('admin')
);

-- Seul le directeur peut créer un mandat
CREATE POLICY "director_creates_appointment"
ON public.admin_appointments FOR INSERT
WITH CHECK (
  public.has_role('director')
  AND appointed_by = auth.uid()
);

-- Seul le directeur peut modifier un mandat (clôture, révocation)
-- L'administrateur peut confirmer sa date de prise de fonction via server action (bypass RLS avec admin client)
CREATE POLICY "director_updates_appointment"
ON public.admin_appointments FOR UPDATE
USING (public.has_role('director'));

-- Suppression interdite (historique préservé)
-- Pas de policy DELETE → personne ne peut supprimer

-- --- audit_logs ---

-- Le directeur voit tous les logs
CREATE POLICY "director_sees_all_audit_logs"
ON public.audit_logs FOR SELECT
USING (public.has_role('director'));

-- L'admin voit les logs qui le concernent
CREATE POLICY "admin_sees_own_audit_logs"
ON public.audit_logs FOR SELECT
USING (
  (actor_id = auth.uid() OR target_id = auth.uid())
  AND public.has_role('admin')
);

-- Insertion uniquement via server actions (aucune policy d'insert client-side)
-- Les logs sont insérés via le client admin (service_role) côté serveur uniquement

-- Pas de policy UPDATE ou DELETE → les logs sont immuables pour tous les rôles

-- ==============================================================================
-- 4. MISE À JOUR DU TRIGGER handle_new_user
-- Pour que les admins invités aient le bon rôle dès l'inscription
-- ==============================================================================

-- Lorsqu'un user est invité avec metadata role='admin', on positionne le bon rôle
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role;
BEGIN
  -- Lire le rôle depuis les métadonnées d'invitation si présent
  v_role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::user_role,
    'student'::user_role
  );

  -- Sécurité : on n'accepte que student ou admin depuis les métadonnées
  -- Le rôle director ne peut être assigné que manuellement
  IF v_role NOT IN ('student', 'admin') THEN
    v_role := 'student';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Nouvel Utilisateur'),
    v_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 5. FONCTION HELPER RLS — is_director()
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_director()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'director'
  );
$$;

-- ==============================================================================
-- DOWN (pour annuler cette migration)
-- ==============================================================================
-- DROP TRIGGER IF EXISTS trg_enforce_single_active_admin ON public.admin_appointments;
-- DROP FUNCTION IF EXISTS public.enforce_single_active_admin();
-- DROP TRIGGER IF EXISTS handle_updated_at_admin_appointments ON public.admin_appointments;
-- DROP INDEX IF EXISTS idx_admin_appointments_unique_active;
-- DROP TABLE IF EXISTS public.audit_logs;
-- DROP TABLE IF EXISTS public.admin_appointments;
-- DROP TYPE IF EXISTS appointment_status;
-- DROP FUNCTION IF EXISTS public.is_director();
