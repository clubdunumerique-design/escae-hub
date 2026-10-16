-- Preserve the existing project_status enum and workflow while making every
-- status transition authorized, compare-and-set, and auditable in one transaction.

CREATE OR REPLACE FUNCTION public.guard_project_status_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND current_setting('app.project_status_transition', true) IS DISTINCT FROM 'allowed' THEN
    RAISE EXCEPTION 'Project status changes must use the authorized workflow';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_project_status_change ON public.projects;
CREATE TRIGGER trg_guard_project_status_change
BEFORE UPDATE OF status ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.guard_project_status_change();

DROP POLICY IF EXISTS "Les étudiants modifient leurs propres projets" ON public.projects;
CREATE POLICY "Les étudiants modifient leurs brouillons"
  ON public.projects FOR UPDATE
  USING (owner_id = auth.uid() AND status = 'draft' AND public.has_role('student'))
  WITH CHECK (owner_id = auth.uid() AND status = 'draft' AND public.has_role('student'));
DROP POLICY IF EXISTS "Les étudiants suppriment leurs propres projets" ON public.projects;
CREATE POLICY "Les étudiants suppriment uniquement leurs brouillons"
  ON public.projects FOR DELETE
  USING (owner_id = auth.uid() AND status = 'draft' AND public.has_role('student'));

CREATE OR REPLACE FUNCTION public.transition_project_status(
  p_project_id uuid,
  p_expected_status project_status,
  p_new_status project_status,
  p_comment text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_owner_id uuid;
  v_status project_status;
  v_allowed boolean := false;
  v_comment text := nullif(btrim(p_comment), '');
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  IF length(coalesce(v_comment, '')) > 1000 THEN
    RAISE EXCEPTION 'Comment is too long';
  END IF;

  SELECT role::text INTO v_role FROM public.profiles WHERE id = v_user_id;
  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  IF v_role = 'student' THEN
    v_allowed := p_expected_status = 'draft' AND p_new_status = 'submitted';
  ELSIF v_role IN ('admin', 'director') THEN
    v_allowed := CASE p_expected_status
      WHEN 'submitted' THEN p_new_status IN ('admin_review', 'rejected')
      WHEN 'admin_review' THEN p_new_status IN ('corrections_requested', 'under_review', 'rejected')
      WHEN 'corrections_requested' THEN p_new_status = 'admin_review'
      WHEN 'under_re_examination' THEN p_new_status = 'under_review'
      WHEN 'under_review' THEN p_new_status = 'jury_evaluation'
      WHEN 'jury_evaluation' THEN p_new_status = 'director_validation'
      WHEN 'director_validation' THEN p_new_status IN ('accepted_for_presentation', 'rejected', 'under_re_examination')
      WHEN 'accepted_for_presentation' THEN p_new_status = 'scheduling'
      WHEN 'scheduling' THEN p_new_status = 'presentation_done'
      WHEN 'presentation_done' THEN p_new_status IN ('approved', 'rejected')
      ELSE false
    END;
  END IF;
  IF NOT v_allowed THEN
    RETURN false;
  END IF;

  SELECT owner_id, status INTO v_owner_id, v_status
  FROM public.projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND OR v_status IS DISTINCT FROM p_expected_status THEN
    RETURN false;
  END IF;
  IF v_role = 'student' AND v_owner_id <> v_user_id THEN
    RETURN false;
  END IF;

  PERFORM set_config('app.project_status_transition', 'allowed', true);
  UPDATE public.projects SET status = p_new_status WHERE id = p_project_id;
  INSERT INTO public.status_history(project_id, from_status, to_status, changed_by, comment)
  VALUES (p_project_id, p_expected_status, p_new_status, v_user_id, v_comment);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_project_status(uuid, project_status, project_status, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_project_status(uuid, project_status, project_status, text)
  TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.status_history FROM anon, authenticated;

-- Direct API writes to team/document rows must obey the same owner + student + draft rules as Server Actions.
DROP POLICY IF EXISTS "L'étudiant gère son équipe de projet" ON public.team_members;
CREATE POLICY "Les étudiants lisent leur équipe"
  ON public.team_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.owner_id = auth.uid() AND public.has_role('student')
  ));
CREATE POLICY "Les étudiants gèrent leur équipe en brouillon"
  ON public.team_members FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.owner_id = auth.uid()
      AND p.status = 'draft' AND public.has_role('student')
  ));
CREATE POLICY "Les étudiants modifient leur équipe en brouillon"
  ON public.team_members FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.owner_id = auth.uid()
      AND p.status = 'draft' AND public.has_role('student')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.owner_id = auth.uid()
      AND p.status = 'draft' AND public.has_role('student')
  ));
CREATE POLICY "Les étudiants suppriment leur équipe en brouillon"
  ON public.team_members FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.owner_id = auth.uid()
      AND p.status = 'draft' AND public.has_role('student')
  ));

DROP POLICY IF EXISTS "L'étudiant gère ses documents" ON public.project_documents;
CREATE POLICY "Les étudiants lisent leurs documents"
  ON public.project_documents FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.owner_id = auth.uid() AND public.has_role('student')
  ));
CREATE POLICY "Les étudiants ajoutent leurs documents en brouillon"
  ON public.project_documents FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid() AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.owner_id = auth.uid()
        AND p.status = 'draft' AND public.has_role('student')
    )
  );
CREATE POLICY "Les étudiants suppriment leurs documents en brouillon"
  ON public.project_documents FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_id AND p.owner_id = auth.uid()
      AND p.status = 'draft' AND public.has_role('student')
  ));

-- Align table-level evaluation/presentation policies with the server actions,
-- which authorize the current admin and director roles.
DROP POLICY IF EXISTS "Jury et Admin peuvent evaluer" ON public.evaluations;
CREATE POLICY "Les administrateurs et directeurs évaluent"
  ON public.evaluations FOR INSERT TO authenticated
  WITH CHECK (
    evaluator_id = auth.uid() AND public.has_role('admin', 'director')
  );
DROP POLICY IF EXISTS "Modification de ses propres evaluations" ON public.evaluations;
CREATE POLICY "Les administrateurs et directeurs modifient leurs évaluations"
  ON public.evaluations FOR UPDATE TO authenticated
  USING (evaluator_id = auth.uid() AND public.has_role('admin', 'director'))
  WITH CHECK (evaluator_id = auth.uid() AND public.has_role('admin', 'director'));

DROP POLICY IF EXISTS "Scheduler et admin peuvent planifier" ON public.presentations;
CREATE POLICY "Les administrateurs et directeurs planifient"
  ON public.presentations FOR INSERT TO authenticated
  WITH CHECK (scheduled_by = auth.uid() AND public.has_role('admin', 'director'));
DROP POLICY IF EXISTS "Scheduler et admin peuvent modifier la planification" ON public.presentations;
CREATE POLICY "Les administrateurs et directeurs modifient la planification"
  ON public.presentations FOR UPDATE TO authenticated
  USING (public.has_role('admin', 'director'))
  WITH CHECK (scheduled_by = auth.uid() AND public.has_role('admin', 'director'));

DROP POLICY IF EXISTS "Les porteurs peuvent uploader des documents" ON storage.objects;
CREATE POLICY "Les étudiants uploadent leurs documents de brouillon"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project_documents'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.has_role('student')
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.owner_id = auth.uid() AND p.status = 'draft'
    )
  );
DROP POLICY IF EXISTS "Les porteurs peuvent supprimer leurs documents" ON storage.objects;
CREATE POLICY "Les étudiants suppriment leurs documents de brouillon"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'project_documents'
    AND public.has_role('student')
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.owner_id = auth.uid() AND p.status = 'draft'
    )
  );

UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ]
WHERE id = 'project_documents';
