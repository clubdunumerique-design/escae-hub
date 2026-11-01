-- Replace the visible term/mandate workflow with a permanent administrator
-- access assignment activated by the recipient's verified email session.
-- Existing admin_appointments and audit rows remain intact for history.

CREATE OR REPLACE FUNCTION public.create_admin_access_invitation(
  p_admin_id UUID,
  p_recipient_email TEXT,
  p_university_id UUID,
  p_access_scope TEXT,
  p_token_hash TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_email TEXT := lower(btrim(p_recipient_email));
  v_access_id UUID;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role('director') THEN
    RAISE EXCEPTION 'Only the director may assign administrator access.';
  END IF;
  IF p_access_scope IS NULL OR p_access_scope NOT IN ('own_university', 'all_universities')
     OR p_university_id IS NULL
     OR p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid administrator access assignment.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.universities WHERE id = p_university_id AND is_active) THEN
    RAISE EXCEPTION 'The selected university is not active.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE u.id = p_admin_id
      AND lower(btrim(u.email)) = v_email
      AND p.role::text <> 'director'
  ) THEN
    RAISE EXCEPTION 'The recipient email does not match an eligible account.';
  END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_admin_id FOR UPDATE;
  IF EXISTS (
    SELECT 1
    FROM public.admin_appointments a
    WHERE a.admin_id = p_admin_id
      AND a.status IN ('pending_acceptance', 'active')
      AND a.university_id IS NOT NULL
      AND a.access_scope IS NOT NULL
      AND (p_access_scope = 'all_universities'
        OR a.access_scope = 'all_universities'
        OR a.university_id = p_university_id)
      AND (
        a.status = 'pending_acceptance'
        OR (a.invitation_accepted_at IS NOT NULL
          AND (a.start_date IS NULL OR a.start_date <= CURRENT_DATE)
          AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE))
      )
  ) THEN
    RAISE EXCEPTION 'An active or pending administrator access assignment already overlaps this scope.';
  END IF;

  INSERT INTO public.admin_appointments (
    admin_id, appointed_by, status, mission_description, start_date, end_date,
    invitation_sent_at, university_id, access_scope
  ) VALUES (
    p_admin_id, v_actor, 'pending_acceptance', NULL, CURRENT_DATE, NULL,
    now(), p_university_id, p_access_scope
  ) RETURNING id INTO v_access_id;

  INSERT INTO public.admin_appointment_invitation_tokens (
    appointment_id, recipient_email, token_hash, expires_at
  ) VALUES (v_access_id, v_email, p_token_hash, now() + interval '24 hours');

  RETURN v_access_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_admin_access_invitation(UUID, TEXT, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_admin_access_invitation(UUID, TEXT, UUID, TEXT, TEXT)
  TO authenticated;

-- A confirmed Supabase email session is the single acceptance action. The
-- invitation still has to target this exact auth user/email, be unexpired,
-- scoped to an active university, and have an unused server-issued token row.
CREATE OR REPLACE FUNCTION public.activate_pending_admin_access_for_current_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT;
  v_email_confirmed_at TIMESTAMPTZ;
  v_activated INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN RETURN FALSE; END IF;

  SELECT lower(btrim(email)), email_confirmed_at
  INTO v_email, v_email_confirmed_at
  FROM auth.users
  WHERE id = v_user_id;

  IF v_email IS NULL OR v_email_confirmed_at IS NULL THEN RETURN FALSE; END IF;

  WITH candidates AS MATERIALIZED (
    SELECT a.id AS appointment_id, t.id AS token_id
    FROM public.admin_appointments a
    JOIN public.admin_appointment_invitation_tokens t
      ON t.appointment_id = a.id
    JOIN public.universities u
      ON u.id = a.university_id AND u.is_active
    JOIN public.profiles p
      ON p.id = a.admin_id AND p.role::text <> 'director'
    WHERE a.admin_id = v_user_id
      AND a.status = 'pending_acceptance'
      AND a.invitation_accepted_at IS NULL
      AND a.access_scope IN ('own_university', 'all_universities')
      AND (a.start_date IS NULL OR a.start_date <= CURRENT_DATE)
      AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
      AND t.recipient_email = v_email
      AND t.consumed_at IS NULL
      AND t.revoked_at IS NULL
      AND t.expires_at > now()
    ORDER BY a.id
    FOR UPDATE OF a, t
  ), consumed AS (
    UPDATE public.admin_appointment_invitation_tokens t
    SET consumed_at = now()
    FROM candidates c
    WHERE t.id = c.token_id
      AND t.consumed_at IS NULL
      AND t.revoked_at IS NULL
      AND t.expires_at > now()
    RETURNING t.appointment_id
  )
  UPDATE public.admin_appointments a
  SET status = 'active', invitation_accepted_at = now(), updated_at = now()
  FROM consumed c
  WHERE a.id = c.appointment_id
    AND a.admin_id = v_user_id
    AND a.status = 'pending_acceptance'
    AND a.invitation_accepted_at IS NULL;

  GET DIAGNOSTICS v_activated = ROW_COUNT;
  IF v_activated = 0 THEN RETURN FALSE; END IF;

  UPDATE public.profiles
  SET role = 'admin', updated_at = now()
  WHERE id = v_user_id AND role::text <> 'director';

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_pending_admin_access_for_current_user()
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.activate_pending_admin_access_for_current_user()
  TO authenticated;

COMMENT ON FUNCTION public.activate_pending_admin_access_for_current_user() IS
  'Activates all scoped, unexpired admin access invitations for the authenticated user after email confirmation; no director follow-up step is required.';
