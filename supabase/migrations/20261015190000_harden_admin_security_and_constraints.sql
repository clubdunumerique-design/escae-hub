-- Migration: 20261015190000_harden_admin_security_and_constraints.sql
-- Description: Durcissement de la sécurité du système de nomination des administrateurs
-- 1. Verrouillage de l'attribution de rôle à l'inscription publique (handle_new_user)
-- 2. Index partiel unique physique pour garantir l'absence de race condition sur le mandat actif
-- 3. Trigger de protection empêchant la modification de rôle par un non-directeur sur profiles

-- ==============================================================================
-- 1. SÉCURISATION DU TRIGGER handle_new_user
-- Règle : Toute inscription directe via l'API publique (signUp) reçoit 'student'.
-- L'élévation au rôle 'admin' est effectuée exclusivement par le serveur de confiance
-- (service_role) lors d'une nomination authentifiée par le directeur.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Sécurité stricte : tout nouvel utilisateur Auth reçoit le rôle 'student' par défaut.
  -- Aucune métadonnée client ne peut influencer le rôle.
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Nouvel Utilisateur'),
    'student'::user_role
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==============================================================================
-- 2. CONTRAINTE D'UNICITÉ PHYSIQUE : UN SEUL MANDAT ACTIF SIMULTANÉMENT
-- L'index partiel unique élimine toute race condition lors de nominations concurrentes.
-- ==============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_appointments_single_active_strict
  ON public.admin_appointments ((1))
  WHERE status = 'active';

-- ==============================================================================
-- 3. PROTECTION DE LA COLONNE 'role' SUR public.profiles
-- Empêche tout utilisateur authentifié (étudiant, admin) de modifier son propre rôle
-- ou celui d'un tiers via des requêtes directes PostgREST. Seul le directeur ou le
-- service_role (clé serveur) peut altérer la colonne 'role'.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Si la requête provient d'un client utilisateur authentifié (non-service_role)
    IF auth.role() = 'authenticated' THEN
      -- Vérifier si l'appelant est le directeur
      IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'director'
      ) THEN
        RAISE EXCEPTION 'Modification non autorisée : seul le directeur peut modifier les rôles.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
BEFORE UPDATE OF role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();
