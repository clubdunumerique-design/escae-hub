-- Multi-university administration: appointment-derived access, one-time
-- appointment-bound invitations, authenticated director RPCs, and full audit.

CREATE TABLE IF NOT EXISTS public.admin_appointment_invitation_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.admin_appointments(id) ON DELETE RESTRICT,
  recipient_email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CONSTRAINT admin_appointment_invitation_token_hash_check
    CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT admin_appointment_invitation_expiry_check
    CHECK (expires_at > issued_at)
);

CREATE INDEX IF NOT EXISTS idx_admin_invitation_tokens_appointment
  ON public.admin_appointment_invitation_tokens (appointment_id, issued_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_invitation_tokens_one_open_per_appointment
  ON public.admin_appointment_invitation_tokens (appointment_id)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;

ALTER TABLE public.admin_appointment_invitation_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_appointment_invitation_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.admin_appointment_invitation_tokens TO service_role;

-- A data permission exists only while at least one accepted mandate is valid.
CREATE OR REPLACE FUNCTION public.has_active_admin_appointment()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.admin_appointments a
    WHERE a.admin_id = auth.uid()
      AND a.status = 'active'
      AND a.university_id IS NOT NULL
      AND a.access_scope IS NOT NULL
      AND a.invitation_accepted_at IS NOT NULL
      AND (a.start_date IS NULL OR a.start_date <= CURRENT_DATE)
      AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
  );
$$;

CREATE OR REPLACE FUNCTION public.effective_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p.role::text = 'director' THEN 'director'
    WHEN public.has_active_admin_appointment() THEN 'admin'
    WHEN p.role::text = 'admin' THEN 'inactive_admin'
    ELSE p.role::text
  END
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$;

-- Keep existing call sites safe: "admin" means a valid accepted mandate, not
-- merely profiles.role='admin'. Other role checks retain their profile meaning.
CREATE OR REPLACE FUNCTION public.has_role(VARIADIC allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role::text = ANY(array_remove(allowed_roles, 'admin'))
    )
    OR ('admin' = ANY(allowed_roles) AND public.has_active_admin_appointment());
$$;

REVOKE ALL ON FUNCTION public.has_active_admin_appointment() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_admin_appointment() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.effective_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.effective_user_role() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.has_role(TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(TEXT[]) TO authenticated, service_role;

-- Prevent direct role changes by users. A user can receive admin UI state only
-- after an accepted, non-revoked mandate exists; access remains date-scoped.
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.role IS NOT DISTINCT FROM OLD.role OR auth.role() IS DISTINCT FROM 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF public.has_role('director') THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = NEW.id
     AND NEW.role::text = 'admin'
     AND EXISTS (
       SELECT 1 FROM public.admin_appointments a
       WHERE a.admin_id = NEW.id
         AND a.status = 'active'
         AND a.invitation_accepted_at IS NOT NULL
         AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
     ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Only the director or an accepted appointment may change administrative role state.';
END;
$$;

-- Capture every meaningful appointment change, including mission, dates,
-- university, scope, acceptance, and revocation. Never record invitation tokens.
CREATE OR REPLACE FUNCTION public.audit_admin_appointment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_action TEXT;
BEGIN
  v_actor := COALESCE(auth.uid(), NEW.appointed_by, OLD.appointed_by);

  IF TG_OP = 'INSERT' THEN
    v_action := 'admin.appointment_created';
    INSERT INTO public.audit_logs(actor_id, action, target_id, target_type, details)
    VALUES (v_actor, v_action, NEW.id, 'admin_appointment',
      jsonb_build_object('after', to_jsonb(NEW)));
    RETURN NEW;
  END IF;

  IF (to_jsonb(OLD) - 'updated_at') IS DISTINCT FROM (to_jsonb(NEW) - 'updated_at') THEN
    v_action := CASE
      WHEN OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'active'
        THEN 'admin.appointment_accepted_or_activated'
      WHEN OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'ended'
        THEN 'admin.appointment_ended'
      WHEN OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'revoked'
        THEN 'admin.appointment_revoked'
      WHEN OLD.mission_description IS DISTINCT FROM NEW.mission_description
        THEN 'admin.appointment_mission_changed'
      WHEN OLD.start_date IS DISTINCT FROM NEW.start_date
        OR OLD.end_date IS DISTINCT FROM NEW.end_date
        THEN 'admin.appointment_dates_changed'
      WHEN OLD.university_id IS DISTINCT FROM NEW.university_id
        OR OLD.access_scope IS DISTINCT FROM NEW.access_scope
        THEN 'admin.appointment_scope_changed'
      WHEN OLD.invitation_sent_at IS DISTINCT FROM NEW.invitation_sent_at
        THEN 'admin.invitation_issued_or_resent'
      ELSE 'admin.appointment_changed'
    END;

    INSERT INTO public.audit_logs(actor_id, action, target_id, target_type, details)
    VALUES (v_actor, v_action, NEW.id, 'admin_appointment',
      jsonb_build_object(
        'before', to_jsonb(OLD) - 'updated_at',
        'after', to_jsonb(NEW) - 'updated_at'
      ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_admin_appointment_change ON public.admin_appointments;
CREATE TRIGGER trg_audit_admin_appointment_change
AFTER INSERT OR UPDATE ON public.admin_appointments
FOR EACH ROW EXECUTE FUNCTION public.audit_admin_appointment_change();

-- Director-only creation and token issuance are checked from auth.uid() inside
-- SECURITY DEFINER functions; application-supplied actor IDs are not trusted.
CREATE OR REPLACE FUNCTION public.create_admin_appointment_invitation(
  p_admin_id UUID,
  p_recipient_email TEXT,
  p_university_id UUID,
  p_access_scope TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_mission_description TEXT,
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
  v_appointment_id UUID;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role('director') THEN
    RAISE EXCEPTION 'Only the authenticated director may create an appointment.';
  END IF;
  IF p_access_scope IS NULL OR p_access_scope NOT IN ('own_university', 'all_universities')
     OR p_university_id IS NULL
     OR p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date
     OR p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$'
     OR length(btrim(coalesce(p_mission_description, ''))) < 2
     OR length(p_mission_description) > 1000 THEN
    RAISE EXCEPTION 'Invalid appointment details.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.universities WHERE id = p_university_id AND is_active) THEN
    RAISE EXCEPTION 'The selected university is not active.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u JOIN public.profiles p ON p.id = u.id
    WHERE u.id = p_admin_id AND lower(btrim(u.email)) = v_email AND p.role::text <> 'director'
  ) THEN
    RAISE EXCEPTION 'The recipient email does not match an eligible account.';
  END IF;

  -- Serialize nominations for the same account. An expired active mandate
  -- does not block a new, non-overlapping mandate; an overlapping valid one
  -- does. An unresolved legacy mandate remains non-authorizing and is not
  -- silently assigned a scope here.
  PERFORM 1 FROM public.profiles WHERE id = p_admin_id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.admin_appointments a
    WHERE a.admin_id = p_admin_id
      AND a.university_id = p_university_id
      AND a.status = 'active'
      AND a.invitation_accepted_at IS NOT NULL
      AND a.access_scope IS NOT NULL
      AND (a.start_date IS NULL OR a.start_date <= p_end_date)
      AND (a.end_date IS NULL OR a.end_date >= p_start_date)
  ) THEN
    RAISE EXCEPTION 'An active appointment overlaps the requested term for this university.';
  END IF;

  INSERT INTO public.admin_appointments (
    admin_id, appointed_by, status, mission_description, start_date, end_date,
    invitation_sent_at, university_id, access_scope
  ) VALUES (
    p_admin_id, v_actor, 'pending_acceptance', nullif(btrim(p_mission_description), ''),
    p_start_date, p_end_date, now(), p_university_id, p_access_scope
  ) RETURNING id INTO v_appointment_id;

  INSERT INTO public.admin_appointment_invitation_tokens (
    appointment_id, recipient_email, token_hash, expires_at
  ) VALUES (v_appointment_id, v_email, p_token_hash, now() + interval '24 hours');

  RETURN v_appointment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_admin_appointment_invitation_token(
  p_appointment_id UUID,
  p_recipient_email TEXT,
  p_token_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT := lower(btrim(p_recipient_email));
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('director') THEN
    RAISE EXCEPTION 'Only the authenticated director may issue an invitation.';
  END IF;
  IF p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid token hash.'; END IF;

  PERFORM 1
  FROM public.admin_appointments a
  JOIN auth.users u ON u.id = a.admin_id
  WHERE a.id = p_appointment_id
    AND a.status = 'pending_acceptance'
    AND a.university_id IS NOT NULL
    AND a.access_scope IS NOT NULL
    AND a.invitation_accepted_at IS NULL
    AND lower(btrim(u.email)) = v_email
  FOR UPDATE OF a;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.admin_appointment_invitation_tokens
  SET revoked_at = now()
  WHERE appointment_id = p_appointment_id
    AND consumed_at IS NULL AND revoked_at IS NULL;

  UPDATE public.admin_appointments
  SET invitation_sent_at = now(), updated_at = now()
  WHERE id = p_appointment_id;

  INSERT INTO public.admin_appointment_invitation_tokens (
    appointment_id, recipient_email, token_hash, expires_at
  ) VALUES (p_appointment_id, v_email, p_token_hash, now() + interval '24 hours');

  RETURN true;
END;
$$;

-- All application writes go through the audited SECURITY DEFINER functions.
-- In particular, a director cannot mark an appointment accepted by direct
-- table UPDATE; only the one-time-token acceptance function can do that.
REVOKE INSERT, UPDATE, DELETE ON public.admin_appointments FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_admin_appointment(
  p_appointment_id UUID,
  p_university_id UUID,
  p_access_scope TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_mission_description TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('director') THEN
    RAISE EXCEPTION 'Only the authenticated director may edit appointments.';
  END IF;
  IF p_university_id IS NULL
     OR p_access_scope IS NULL OR p_access_scope NOT IN ('own_university', 'all_universities')
     OR p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date
     OR length(btrim(coalesce(p_mission_description, ''))) < 2
     OR length(p_mission_description) > 1000
     OR NOT EXISTS (SELECT 1 FROM public.universities WHERE id = p_university_id AND is_active) THEN
    RAISE EXCEPTION 'Invalid appointment details.';
  END IF;
  UPDATE public.admin_appointments
  SET university_id = p_university_id,
      access_scope = p_access_scope,
      start_date = p_start_date,
      end_date = p_end_date,
      mission_description = btrim(p_mission_description),
      updated_at = now()
  WHERE id = p_appointment_id
    AND status IN ('active', 'pending_acceptance');
  IF FOUND AND EXISTS (
    SELECT 1 FROM public.admin_appointments edited
    JOIN public.admin_appointments other
      ON other.admin_id = edited.admin_id
     AND other.university_id = edited.university_id
     AND other.id <> edited.id
    WHERE edited.id = p_appointment_id
      AND edited.status IN ('active', 'pending_acceptance')
      AND other.status IN ('active', 'pending_acceptance')
      AND (other.status = 'pending_acceptance' OR other.invitation_accepted_at IS NOT NULL)
      AND other.access_scope IS NOT NULL
      AND (other.start_date IS NULL OR other.start_date <= edited.end_date)
      AND (other.end_date IS NULL OR other.end_date >= edited.start_date)
  ) THEN
    RAISE EXCEPTION 'The edited term overlaps another open appointment for this university.';
  END IF;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.update_admin_appointment(UUID, UUID, TEXT, DATE, DATE, TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.update_admin_appointment(UUID, UUID, TEXT, DATE, DATE, TEXT) TO authenticated;

-- The authenticated session, invitation token, appointment ID, account ID, and
-- confirmed recipient email are checked and consumed in one transaction.
CREATE OR REPLACE FUNCTION public.accept_admin_invitation(
  p_appointment_id UUID,
  p_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT;
  v_email_confirmed_at TIMESTAMPTZ;
  v_token_id UUID;
  v_previous_role public.user_role;
BEGIN
  IF v_user_id IS NULL OR p_token IS NULL OR length(p_token) < 40 OR length(p_token) > 100 THEN
    RETURN false;
  END IF;

  SELECT lower(btrim(email)), email_confirmed_at
  INTO v_email, v_email_confirmed_at
  FROM auth.users WHERE id = v_user_id;
  IF v_email IS NULL OR v_email_confirmed_at IS NULL THEN RETURN false; END IF;

  PERFORM 1
  FROM public.admin_appointments a
  WHERE a.id = p_appointment_id
    AND a.admin_id = v_user_id
    AND a.status = 'pending_acceptance'
    AND a.university_id IS NOT NULL
    AND a.access_scope IS NOT NULL
    AND a.invitation_accepted_at IS NULL
    AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
    AND NOT EXISTS (
      SELECT 1 FROM public.admin_appointments other
      WHERE other.admin_id = a.admin_id
        AND other.university_id = a.university_id
        AND other.id <> a.id
        AND other.status = 'active'
        AND other.access_scope IS NOT NULL
        AND other.invitation_accepted_at IS NOT NULL
        AND (other.start_date IS NULL OR other.start_date <= a.end_date)
        AND (other.end_date IS NULL OR other.end_date >= a.start_date)
    )
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  SELECT t.id INTO v_token_id
  FROM public.admin_appointment_invitation_tokens t
  WHERE t.appointment_id = p_appointment_id
    AND t.recipient_email = v_email
    AND t.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    AND t.consumed_at IS NULL
    AND t.revoked_at IS NULL
    AND t.expires_at > now()
  FOR UPDATE;
  IF v_token_id IS NULL THEN RETURN false; END IF;

  UPDATE public.admin_appointment_invitation_tokens
  SET consumed_at = now()
  WHERE id = v_token_id AND consumed_at IS NULL AND revoked_at IS NULL;
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.admin_appointments
  SET status = 'active', invitation_accepted_at = now(), updated_at = now()
  WHERE id = p_appointment_id
    AND status = 'pending_acceptance'
    AND invitation_accepted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment acceptance lost a concurrent update.'; END IF;

  SELECT role INTO v_previous_role FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  IF v_previous_role IS NULL OR v_previous_role = 'director' THEN
    RAISE EXCEPTION 'The invited account cannot accept an administrator appointment.';
  END IF;
  UPDATE public.profiles SET role = 'admin', updated_at = now() WHERE id = v_user_id;

  INSERT INTO public.audit_logs(actor_id, action, target_id, target_type, details)
  VALUES (v_user_id, 'admin.invitation_accepted', p_appointment_id,
    'admin_appointment', jsonb_build_object('admin_id', v_user_id));
  RETURN true;
END;
$$;

-- Finish/revoke a precise appointment. Caller identity is auth.uid(); no
-- application-supplied actor UUID can impersonate the director.
DROP FUNCTION IF EXISTS public.finish_admin_appointment(UUID, UUID, public.appointment_status, DATE, TEXT);
CREATE OR REPLACE FUNCTION public.finish_admin_appointment(
  p_appointment_id UUID,
  p_final_status public.appointment_status,
  p_end_date DATE,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_appointment public.admin_appointments%ROWTYPE;
  v_role public.user_role;
  v_has_other_valid_mandate BOOLEAN;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role('director') THEN
    RAISE EXCEPTION 'Only the authenticated director may finish an appointment.';
  END IF;
  IF p_final_status IS NULL OR p_final_status NOT IN ('ended', 'revoked') OR p_end_date IS NULL
     OR (p_final_status = 'revoked' AND p_end_date <> CURRENT_DATE) THEN
    RAISE EXCEPTION 'Invalid final status or end date.';
  END IF;

  SELECT * INTO v_appointment
  FROM public.admin_appointments
  WHERE id = p_appointment_id
  FOR UPDATE;
  IF NOT FOUND OR v_appointment.status IN ('ended', 'revoked') THEN RETURN false; END IF;
  IF p_final_status = 'ended'
     AND v_appointment.start_date IS NOT NULL
     AND p_end_date < v_appointment.start_date THEN
    RAISE EXCEPTION 'End date precedes appointment start date.';
  END IF;

  UPDATE public.admin_appointments
  SET status = p_final_status,
      end_date = p_end_date,
      revocation_reason = nullif(btrim(p_reason), ''),
      updated_at = now()
  WHERE id = p_appointment_id;

  UPDATE public.admin_appointment_invitation_tokens
  SET revoked_at = now()
  WHERE appointment_id = p_appointment_id
    AND consumed_at IS NULL AND revoked_at IS NULL;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_appointment.admin_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Administrator profile not found.'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.admin_appointments a
    WHERE a.admin_id = v_appointment.admin_id
      AND a.id <> p_appointment_id
      AND a.status = 'active'
      AND a.university_id IS NOT NULL
      AND a.access_scope IS NOT NULL
      AND a.invitation_accepted_at IS NOT NULL
      AND (a.start_date IS NULL OR a.start_date <= CURRENT_DATE)
      AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
  ) INTO v_has_other_valid_mandate;

  IF v_role = 'admin' AND NOT v_has_other_valid_mandate THEN
    UPDATE public.profiles SET role = 'student', updated_at = now()
    WHERE id = v_appointment.admin_id;
  ELSIF v_role <> 'director' AND v_has_other_valid_mandate AND v_role <> 'admin' THEN
    UPDATE public.profiles SET role = 'admin', updated_at = now()
    WHERE id = v_appointment.admin_id;
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_admin_appointment_invitation(UUID, TEXT, UUID, TEXT, DATE, DATE, TEXT, TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.create_admin_appointment_invitation(UUID, TEXT, UUID, TEXT, DATE, DATE, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.issue_admin_appointment_invitation_token(UUID, TEXT, TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.issue_admin_appointment_invitation_token(UUID, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.accept_admin_invitation(UUID, TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.accept_admin_invitation(UUID, TEXT) TO authenticated;
-- The old one-argument service-role RPC allowed acceptance without a personal
-- token. Preserve the function object for dependencies but disable every role.
REVOKE ALL ON FUNCTION public.accept_admin_invitation(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.finish_admin_appointment(UUID, public.appointment_status, DATE, TEXT) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.finish_admin_appointment(UUID, public.appointment_status, DATE, TEXT) TO authenticated;

-- Rollback is intentionally non-destructive: restore prior function definitions
-- and policies only after restoring backup. Keep token/audit history; revoke or
-- expire outstanding invitation tokens before disabling the acceptance function.
