-- Migration: 20261011235900_simplify_to_three_roles.sql
-- Description: Simplification stricte aux 3 rôles : student, admin, director

-- 1. Mise à jour des fonctions RLS helpers
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
    AND role IN ('admin', 'director')
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

-- 2. Mise à jour de la politique de mise à jour des profils
DROP POLICY IF EXISTS "Le personnel autorise met a jour les profils" ON public.profiles;
CREATE POLICY "Le personnel autorise met a jour les profils"
ON public.profiles FOR UPDATE USING (
  public.has_role('admin', 'director')
);
