-- Migration: 20241010030000_evaluations_schema
-- Description: Creation de la table evaluations pour les jurys

CREATE TABLE public.evaluations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    evaluator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    innovation_score INTEGER CHECK (innovation_score >= 0 AND innovation_score <= 10),
    feasibility_score INTEGER CHECK (feasibility_score >= 0 AND feasibility_score <= 10),
    impact_score INTEGER CHECK (impact_score >= 0 AND impact_score <= 10),
    comments TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id, evaluator_id) -- Un evaluateur ne peut evaluer un projet qu'une seule fois
);

-- RLS
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- Le staff peut lire toutes les evaluations
CREATE POLICY "Le staff peut lire les evaluations" 
ON public.evaluations FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'verifier', 'director', 'reviewer', 'scheduler')
    )
);

-- Seul un reviewer ou un admin peut inserer une evaluation
CREATE POLICY "Jury et Admin peuvent evaluer" 
ON public.evaluations FOR INSERT 
TO authenticated 
WITH CHECK (
    auth.uid() = evaluator_id AND
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'reviewer')
    )
);

-- Modification de ses propres evaluations
CREATE POLICY "Modification de ses propres evaluations" 
ON public.evaluations FOR UPDATE 
TO authenticated 
USING (
    auth.uid() = evaluator_id
)
WITH CHECK (
    auth.uid() = evaluator_id
);
