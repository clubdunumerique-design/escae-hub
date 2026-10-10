-- Migration: 20241010040000_presentations_schema
-- Description: Table de planification des soutenances de projets

CREATE TABLE public.presentations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    room TEXT NOT NULL,
    notes TEXT,
    scheduled_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(project_id) -- Un projet n'a qu'une seule soutenance planifiee a la fois
);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_presentation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_presentation_updated_at
BEFORE UPDATE ON public.presentations
FOR EACH ROW EXECUTE FUNCTION update_presentation_updated_at();

-- RLS
ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;

-- Tout utilisateur authentifie peut lire les presentations (etudiants inclus)
CREATE POLICY "Tout le monde peut voir les planifications"
ON public.presentations FOR SELECT
TO authenticated
USING (true);

-- Seuls scheduler et admin peuvent inserer/modifier
CREATE POLICY "Scheduler et admin peuvent planifier"
ON public.presentations FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('scheduler', 'admin')
    )
);

CREATE POLICY "Scheduler et admin peuvent modifier la planification"
ON public.presentations FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('scheduler', 'admin')
    )
);
