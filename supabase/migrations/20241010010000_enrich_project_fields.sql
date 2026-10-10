-- Migration: 20241010010000_enrich_project_fields
-- Description: Ajout de champs detailles pour les projets (probleme, solution, faisabilite, impact, budget)

-- ==============================================================================
-- UP
-- ==============================================================================

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS problem TEXT,
ADD COLUMN IF NOT EXISTS solution TEXT,
ADD COLUMN IF NOT EXISTS feasibility TEXT,
ADD COLUMN IF NOT EXISTS impact TEXT,
ADD COLUMN IF NOT EXISTS budget NUMERIC;

-- ==============================================================================
-- DOWN
-- ==============================================================================

-- ALTER TABLE public.projects 
-- DROP COLUMN IF EXISTS problem,
-- DROP COLUMN IF EXISTS solution,
-- DROP COLUMN IF EXISTS feasibility,
-- DROP COLUMN IF EXISTS impact,
-- DROP COLUMN IF EXISTS budget;
