-- Limite les opérations de création et de modification des projets aux étudiants.
-- Les règles de lecture du personnel restent en place pour les dashboards de gestion.

DROP POLICY IF EXISTS "L'étudiant peut voir et gérer ses propres projets"
  ON public.projects;

CREATE POLICY "Les étudiants consultent leurs propres projets"
  ON public.projects FOR SELECT
  USING (owner_id = auth.uid() AND public.has_role('student'));

CREATE POLICY "Les étudiants créent leurs propres projets"
  ON public.projects FOR INSERT
  WITH CHECK (owner_id = auth.uid() AND public.has_role('student'));

CREATE POLICY "Les étudiants modifient leurs propres projets"
  ON public.projects FOR UPDATE
  USING (owner_id = auth.uid() AND public.has_role('student'))
  WITH CHECK (owner_id = auth.uid() AND public.has_role('student'));

CREATE POLICY "Les étudiants suppriment leurs propres projets"
  ON public.projects FOR DELETE
  USING (owner_id = auth.uid() AND public.has_role('student'));

-- Le directeur doit pouvoir appliquer ses décisions finales comme prévu par les actions serveur.
CREATE POLICY "Le directeur prend les décisions finales sur les projets"
  ON public.projects FOR UPDATE
  USING (
    public.has_role('director')
    AND status IN ('director_validation', 'accepted_for_presentation', 'scheduling', 'presentation_done', 'final_decision')
  )
  WITH CHECK (
    public.has_role('director')
    AND status IN ('approved', 'rejected', 'final_decision')
  );
