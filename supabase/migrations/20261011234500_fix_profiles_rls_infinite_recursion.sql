-- Migration: Fix infinite recursion in profiles RLS policies
-- Description: Utilisation de fonctions SECURITY DEFINER pour briser la récursion infinie sur la table profiles

-- 1. Fonctions helpers SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role != 'student'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(VARIADIC allowed_roles text[])
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role::text = ANY(allowed_roles)
  );
$$;

-- 2. Mise à jour des politiques sur profiles
DROP POLICY IF EXISTS "Le personnel (hors étudiant) voit tous les profils" ON public.profiles;
CREATE POLICY "Le personnel (hors étudiant) voit tous les profils" 
ON public.profiles FOR SELECT USING (
  public.is_staff()
);

DROP POLICY IF EXISTS "Le personnel autorise met a jour les profils" ON public.profiles;
CREATE POLICY "Le personnel autorise met a jour les profils"
ON public.profiles FOR UPDATE USING (
  public.has_role('admin', 'verifier', 'director')
);

-- 3. Mise à jour des politiques sur projects
DROP POLICY IF EXISTS "Le personnel voit l'intégralité des projets" ON public.projects;
CREATE POLICY "Le personnel voit l'intégralité des projets" 
ON public.projects FOR SELECT USING (
  public.is_staff()
);

DROP POLICY IF EXISTS "L'administrateur peut modifier tous les projets" ON public.projects;
CREATE POLICY "L'administrateur peut modifier tous les projets"
ON public.projects FOR UPDATE USING (
  public.has_role('admin')
);

-- 4. Mise à jour des politiques sur team_members
DROP POLICY IF EXISTS "Le personnel voit les équipes" ON public.team_members;
CREATE POLICY "Le personnel voit les équipes" 
ON public.team_members FOR SELECT USING (
  public.is_staff()
);

-- 5. Mise à jour des politiques sur project_documents
DROP POLICY IF EXISTS "Le personnel voit tous les documents" ON public.project_documents;
CREATE POLICY "Le personnel voit tous les documents" 
ON public.project_documents FOR SELECT USING (
  public.is_staff()
);

-- 6. Mise à jour des politiques sur status_history
DROP POLICY IF EXISTS "Le personnel voit l'historique de tous les projets" ON public.status_history;
CREATE POLICY "Le personnel voit l'historique de tous les projets" 
ON public.status_history FOR SELECT USING (
  public.is_staff()
);
