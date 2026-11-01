-- Draft for review; depends on the foundation and appointment-scope migrations.
-- Tightens matricule claims and scopes staff reads/writes to appointment access.

CREATE OR REPLACE FUNCTION public.has_university_access(p_university_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.has_role('director') OR EXISTS (
    SELECT 1
    FROM public.admin_appointments a
    WHERE a.admin_id = auth.uid()
      AND a.status = 'active'
      AND coalesce(a.start_date, CURRENT_DATE) <= CURRENT_DATE
      AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
      AND public.has_role('admin')
      AND (
        a.access_scope = 'all_universities'
        OR (a.access_scope = 'own_university' AND a.university_id = p_university_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.has_university_access(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_university_access(UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS "Le personnel (hors étudiant) voit tous les profils" ON public.profiles;
CREATE POLICY "Le personnel consulte les profils de son périmètre"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    public.has_role('director')
    OR (role = 'student' AND public.has_university_access(university_id))
  );

DROP POLICY IF EXISTS "staff_sees_student_registry" ON public.student_matricule_registry;
CREATE POLICY "Le personnel consulte le registre de son périmètre"
  ON public.student_matricule_registry FOR SELECT TO authenticated
  USING (public.has_university_access(university_id));

DROP POLICY IF EXISTS "staff_updates_student_registry" ON public.student_matricule_registry;
CREATE POLICY "Le personnel met à jour le registre de son périmètre"
  ON public.student_matricule_registry FOR UPDATE TO authenticated
  USING (public.has_university_access(university_id))
  WITH CHECK (public.has_university_access(university_id));

REVOKE INSERT, UPDATE, DELETE ON public.student_matricule_registry FROM anon, authenticated;
REVOKE UPDATE ON public.profiles FROM anon, authenticated;

-- Only an explicitly verified registry row can verify a profile. The call remains
-- service-role-only; the server action must pass the university selected at signup.
-- Retain the legacy overload for dependency compatibility but make it unusable;
-- all application claims must pass the selected university explicitly.
REVOKE ALL ON FUNCTION public.claim_student_matricule(UUID, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.claim_student_matricule(
  p_user_id UUID,
  p_university_id UUID,
  p_matricule TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT;
  v_email_confirmed_at TIMESTAMPTZ;
  v_full_name TEXT;
  v_role TEXT;
  v_profile_university UUID;
  v_existing_student_id TEXT;
  v_registry_id UUID;
  v_registry_claim UUID;
  v_department TEXT;
  v_matricule TEXT := upper(btrim(coalesce(p_matricule, '')));
  v_registry_email TEXT;
  v_registry_name TEXT;
BEGIN
  IF coalesce(
       nullif(current_setting('request.jwt.claim.role', true), ''),
       nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
       ''
     ) <> 'service_role' THEN
    RAISE EXCEPTION 'Not authorized to claim student matricules';
  END IF;

  IF p_university_id IS NULL OR length(v_matricule) < 3 OR length(v_matricule) > 30
     OR v_matricule !~ '^[A-Z0-9._/-]+$' THEN
    RETURN false;
  END IF;

  SELECT lower(btrim(email)), email_confirmed_at
    INTO v_email, v_email_confirmed_at
    FROM auth.users WHERE id = p_user_id;
  IF v_email IS NULL OR v_email_confirmed_at IS NULL THEN RETURN false; END IF;

  SELECT role::text, full_name, university_id, student_id
    INTO v_role, v_full_name, v_profile_university, v_existing_student_id
    FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF v_role IS DISTINCT FROM 'student'
     OR v_profile_university IS DISTINCT FROM p_university_id
     OR (v_existing_student_id IS NOT NULL AND upper(btrim(v_existing_student_id)) <> v_matricule) THEN
    RETURN false;
  END IF;

  SELECT id, claimed_by_user_id, field_of_study,
         lower(btrim(email)),
         lower(regexp_replace(normalize(btrim(full_name), NFC), '[[:space:]]+', ' ', 'g'))
    INTO v_registry_id, v_registry_claim, v_department, v_registry_email, v_registry_name
    FROM public.student_matricule_registry
    WHERE university_id = p_university_id
      AND upper(btrim(matricule)) = v_matricule
      AND verification_status = 'verified'
    FOR UPDATE;

  IF v_registry_id IS NULL
     OR (v_registry_claim IS NOT NULL AND v_registry_claim <> p_user_id)
     OR v_registry_email <> v_email
     OR v_registry_name <> lower(regexp_replace(normalize(btrim(v_full_name), NFC), '[[:space:]]+', ' ', 'g')) THEN
    RETURN false;
  END IF;

  UPDATE public.student_matricule_registry
    SET claimed_by_user_id = p_user_id,
        claimed_at = coalesce(claimed_at, now()),
        updated_at = now()
    WHERE id = v_registry_id
      AND (claimed_by_user_id IS NULL OR claimed_by_user_id = p_user_id);
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.profiles
    SET student_id = v_matricule,
        is_verified = true,
        department = coalesce(v_department, department),
        updated_at = now()
    WHERE id = p_user_id
      AND university_id = p_university_id
      AND (student_id IS NULL OR upper(btrim(student_id)) = v_matricule);
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile matricule changed during claim'; END IF;

  INSERT INTO public.audit_logs(actor_id, action, target_id, target_type, details)
  VALUES (
    p_user_id,
    'student.matricule_claimed',
    v_registry_id,
    'student_matricule_registry',
    jsonb_build_object('profile_id', p_user_id,
      'university_id', p_university_id,
      'matricule', v_matricule)
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_student_matricule(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_student_matricule(UUID, UUID, TEXT) TO service_role;

-- Scope staff project reads and all child-table reads through the owner profile.
DROP POLICY IF EXISTS "Le personnel voit l'intégralité des projets" ON public.projects;
-- The initial schema also granted every profile with role=admin a global
-- UPDATE policy. Removing only the broad SELECT policy is insufficient:
-- permissive RLS policies are ORed together, so this would bypass mandate
-- scope for direct PostgREST updates.
DROP POLICY IF EXISTS "L'administrateur peut modifier tous les projets" ON public.projects;
CREATE POLICY "Le personnel consulte les projets de son périmètre"
  ON public.projects FOR SELECT TO authenticated
  USING (
    public.has_role('director') OR EXISTS (
      SELECT 1 FROM public.profiles owner
      WHERE owner.id = owner_id AND owner.role = 'student'
        AND public.has_university_access(owner.university_id)
    )
  );

DROP POLICY IF EXISTS "Le personnel voit les équipes" ON public.team_members;
CREATE POLICY "Le personnel consulte les équipes de son périmètre"
  ON public.team_members FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects pr
    JOIN public.profiles owner ON owner.id = pr.owner_id
    WHERE pr.id = project_id
      AND (public.has_role('director') OR public.has_university_access(owner.university_id))
  ));

DROP POLICY IF EXISTS "Le personnel voit tous les documents" ON public.project_documents;
CREATE POLICY "Le personnel consulte les documents de son périmètre"
  ON public.project_documents FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects pr
    JOIN public.profiles owner ON owner.id = pr.owner_id
    WHERE pr.id = project_id
      AND (public.has_role('director') OR public.has_university_access(owner.university_id))
  ));

DROP POLICY IF EXISTS "Le personnel voit l'historique de tous les projets" ON public.status_history;
CREATE POLICY "Le personnel consulte l'historique de son périmètre"
  ON public.status_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects pr
    JOIN public.profiles owner ON owner.id = pr.owner_id
    WHERE pr.id = project_id
      AND (public.has_role('director') OR public.has_university_access(owner.university_id))
  ));

DROP POLICY IF EXISTS "Le staff peut lire les evaluations" ON public.evaluations;
CREATE POLICY "Le personnel consulte les évaluations de son périmètre"
  ON public.evaluations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects pr
    JOIN public.profiles owner ON owner.id = pr.owner_id
    WHERE pr.id = project_id
      AND (public.has_role('director') OR public.has_university_access(owner.university_id))
  ));

DROP POLICY IF EXISTS "Les administrateurs et directeurs évaluent" ON public.evaluations;
CREATE POLICY "Les administrateurs et directeurs évaluent leur périmètre"
  ON public.evaluations FOR INSERT TO authenticated
  WITH CHECK (
    evaluator_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects pr
      JOIN public.profiles owner ON owner.id = pr.owner_id
      WHERE pr.id = project_id
        AND (public.has_role('director') OR public.has_university_access(owner.university_id))
    )
  );

DROP POLICY IF EXISTS "Les administrateurs et directeurs modifient leurs évaluations" ON public.evaluations;
CREATE POLICY "Les administrateurs et directeurs modifient leurs évaluations de périmètre"
  ON public.evaluations FOR UPDATE TO authenticated
  USING (
    evaluator_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects pr
      JOIN public.profiles owner ON owner.id = pr.owner_id
      WHERE pr.id = project_id
        AND (public.has_role('director') OR public.has_university_access(owner.university_id))
    )
  )
  WITH CHECK (
    evaluator_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects pr
      JOIN public.profiles owner ON owner.id = pr.owner_id
      WHERE pr.id = project_id
        AND (public.has_role('director') OR public.has_university_access(owner.university_id))
    )
  );

DROP POLICY IF EXISTS "Tout le monde peut voir les planifications" ON public.presentations;
CREATE POLICY "Le personnel consulte les planifications de son périmètre"
  ON public.presentations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects pr
    JOIN public.profiles owner ON owner.id = pr.owner_id
    WHERE pr.id = project_id
      AND (public.has_role('director') OR public.has_university_access(owner.university_id))
  ));
CREATE POLICY "Les étudiants consultent leurs planifications"
  ON public.presentations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects pr
    WHERE pr.id = project_id AND pr.owner_id = auth.uid()
      AND public.has_role('student')
  ));

-- The former policies checked only the staff role and allowed a limited
-- administrator to schedule any known project UUID. Enforce owner scope on
-- both INSERT and UPDATE, including direct PostgREST calls.
DROP POLICY IF EXISTS "Les administrateurs et directeurs planifient" ON public.presentations;
CREATE POLICY "Le personnel planifie dans son périmètre"
  ON public.presentations FOR INSERT TO authenticated
  WITH CHECK (
    scheduled_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects pr
      JOIN public.profiles owner ON owner.id = pr.owner_id
      WHERE pr.id = project_id
        AND (public.has_role('director') OR public.has_university_access(owner.university_id))
    )
  );
DROP POLICY IF EXISTS "Les administrateurs et directeurs modifient la planification" ON public.presentations;
CREATE POLICY "Le personnel modifie les planifications de son périmètre"
  ON public.presentations FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects pr
    JOIN public.profiles owner ON owner.id = pr.owner_id
    WHERE pr.id = project_id
      AND (public.has_role('director') OR public.has_university_access(owner.university_id))
  ))
  WITH CHECK (
    scheduled_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.projects pr
      JOIN public.profiles owner ON owner.id = pr.owner_id
      WHERE pr.id = project_id
        AND (public.has_role('director') OR public.has_university_access(owner.university_id))
    )
  );

-- Protect private project files from cross-university access.
DROP POLICY IF EXISTS "Le staff et le porteur peuvent lire les documents" ON storage.objects;
CREATE POLICY "Le personnel et le porteur lisent les fichiers de leur périmètre"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'project_documents'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT pr.id::text FROM public.projects pr WHERE pr.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.projects pr
        JOIN public.profiles owner ON owner.id = pr.owner_id
        WHERE pr.id::text = (storage.foldername(name))[1]
          AND (public.has_role('director') OR public.has_university_access(owner.university_id))
      )
    )
  );

-- Scope administrative status transitions inside the security-definer RPC.
CREATE OR REPLACE FUNCTION public.transition_project_status(
  p_project_id UUID,
  p_expected_status project_status,
  p_new_status project_status,
  p_comment TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_role TEXT;
  v_owner_id UUID;
  v_owner_university UUID;
  v_status project_status;
  v_allowed BOOLEAN := false;
  v_comment TEXT := nullif(btrim(p_comment), '');
  v_is_student BOOLEAN := false;
  v_is_admin BOOLEAN := false;
  v_is_director BOOLEAN := false;
BEGIN
  IF v_user_id IS NULL THEN RETURN false; END IF;
  IF length(coalesce(v_comment, '')) > 1000 THEN RAISE EXCEPTION 'Comment is too long'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN RETURN false; END IF;
  v_is_student := public.has_role('student');
  v_is_admin := public.has_role('admin');
  v_is_director := public.has_role('director');

  IF v_is_student AND NOT v_is_admin AND NOT v_is_director THEN
    v_allowed := p_expected_status = 'draft' AND p_new_status = 'submitted';
  ELSIF v_is_director OR v_is_admin THEN
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
  IF NOT v_allowed THEN RETURN false; END IF;

  SELECT pr.owner_id, pr.status, owner.university_id
    INTO v_owner_id, v_status, v_owner_university
    FROM public.projects pr
    JOIN public.profiles owner ON owner.id = pr.owner_id
    WHERE pr.id = p_project_id FOR UPDATE OF pr;
  IF NOT FOUND OR v_status IS DISTINCT FROM p_expected_status THEN RETURN false; END IF;
  IF v_is_student AND NOT v_is_admin AND NOT v_is_director AND v_owner_id <> v_user_id THEN RETURN false; END IF;
  IF v_is_admin AND NOT v_is_director AND NOT public.has_university_access(v_owner_university) THEN RETURN false; END IF;

  PERFORM set_config('app.project_status_transition', 'allowed', true);
  UPDATE public.projects SET status = p_new_status WHERE id = p_project_id;
  INSERT INTO public.status_history(project_id, from_status, to_status, changed_by, comment)
  VALUES (p_project_id, p_expected_status, p_new_status, v_user_id, v_comment);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.transition_project_status(UUID, project_status, project_status, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_project_status(UUID, project_status, project_status, TEXT) TO authenticated;

-- Rollback note: restore the prior global staff policies and two-argument claim
-- function only after handling any cross-university matricule duplicates.
