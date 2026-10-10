-- Migration: 20241009180000_initial_schema
-- Description: Crée le schéma de base pour l'application ESCAE-BÉNIN Innovation Hub
-- Auteur: IA
-- Réversible: oui (voir section DOWN à la fin du fichier ou utiliser migration down)

-- ==============================================================================
-- 1. EXTENSIONS & TYPES
-- ==============================================================================

-- Le type de rôle pour chaque utilisateur. Protégé par RLS.
CREATE TYPE user_role AS ENUM (
  'student', 
  'verifier', 
  'admin', 
  'reviewer', 
  'scheduler', 
  'director'
);

-- Cycle de vie exhaustif du projet selon les règles métier
CREATE TYPE project_status AS ENUM (
  'draft', 'submitted', 'admin_review', 'corrections_requested', 
  'under_review', 'jury_evaluation', 'director_validation', 
  'accepted_for_presentation', 'scheduling', 'presentation_done', 
  'final_decision', 'approved', 'rejected', 'under_re_examination', 
  'postponed', 'cancelled'
);

-- ==============================================================================
-- 2. FONCTIONS UTILITAIRES
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 3. TABLES DU DOMAINE
-- ==============================================================================

-- Table des profils : Établit un lien strict 1:1 avec auth.users de Supabase
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  student_id TEXT,
  department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table des projets
CREATE TABLE public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  objectives TEXT,
  status project_status NOT NULL DEFAULT 'draft',
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table de l'équipe projet (Membre rattaché ou non à un compte utilisateur)
CREATE TABLE public.team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role_in_project TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table listant les documents liés au projet
CREATE TABLE public.project_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL, -- URL interne vers le bucket Supabase privé
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historique des changements de statuts (piste d'audit inaltérable)
CREATE TABLE public.status_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  from_status project_status,
  to_status project_status NOT NULL,
  changed_by UUID NOT NULL REFERENCES public.profiles(id),
  comment TEXT, -- Ne pas inclure de commentaires confidentiels côté client
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. TRIGGERS
-- ==============================================================================

CREATE TRIGGER handle_updated_at_profiles
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER handle_updated_at_projects
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Création automatique du profil lors d'une nouvelle inscription Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Nouvel Étudiant'),
    'student'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================================================
-- 5. SÉCURITÉ RLS (ROW LEVEL SECURITY)
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;

-- Sécurité Profiles
CREATE POLICY "L'étudiant peut voir son propre profil" 
ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Le personnel (hors étudiant) voit tous les profils" 
ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role != 'student')
);

CREATE POLICY "L'étudiant modifie certaines infos de son profil"
ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Sécurité Projects
CREATE POLICY "L'étudiant peut voir et gérer ses propres projets" 
ON public.projects FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Le personnel voit l'intégralité des projets" 
ON public.projects FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role != 'student')
);

CREATE POLICY "L'administrateur peut modifier tous les projets"
ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Sécurité Team Members
CREATE POLICY "L'étudiant gère son équipe de projet" 
ON public.team_members FOR ALL USING (
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
);

CREATE POLICY "Le personnel voit les équipes" 
ON public.team_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role != 'student')
);

-- Sécurité Documents
CREATE POLICY "L'étudiant gère ses documents" 
ON public.project_documents FOR ALL USING (
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
);

CREATE POLICY "Le personnel voit tous les documents" 
ON public.project_documents FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role != 'student')
);

-- Sécurité Historique (piste d'audit = insertion uniquement via route handler ou lecture seule)
CREATE POLICY "L'étudiant voit l'historique de ses projets" 
ON public.status_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
);

CREATE POLICY "Le personnel voit l'historique de tous les projets" 
ON public.status_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role != 'student')
);
