-- Atomic role revocation and immutable audit trail for administrator mandate
-- changes, plus database-level audit for presentation scheduling.

CREATE OR REPLACE FUNCTION public.finish_admin_appointment(
  p_actor_id uuid,
  p_appointment_id uuid,
  p_final_status public.appointment_status,
  p_end_date date,
  p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment public.admin_appointments%ROWTYPE;
  v_previous_role public.user_role;
  v_role_rows integer;
BEGIN
  IF p_final_status NOT IN ('ended', 'revoked') THEN
    RAISE EXCEPTION 'Statut final invalide';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_actor_id AND role = 'director') THEN
    RAISE EXCEPTION 'Seul le directeur peut clôturer un mandat';
  END IF;

  SELECT * INTO v_appointment
  FROM public.admin_appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND OR v_appointment.status IN ('ended', 'revoked') THEN
    RETURN false;
  END IF;
  IF v_appointment.start_date IS NOT NULL AND p_end_date < v_appointment.start_date THEN
    RAISE EXCEPTION 'La date de fin précède la date de prise de fonction';
  END IF;

  UPDATE public.admin_appointments
  SET status = p_final_status,
      end_date = p_end_date,
      revocation_reason = p_reason,
      updated_at = now()
  WHERE id = p_appointment_id;

  SELECT role INTO v_previous_role
  FROM public.profiles WHERE id = v_appointment.admin_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profil administrateur introuvable'; END IF;

  UPDATE public.profiles
  SET role = 'student', updated_at = now()
  WHERE id = v_appointment.admin_id AND role = 'admin';
  GET DIAGNOSTICS v_role_rows = ROW_COUNT;

  IF v_role_rows = 1 THEN
    INSERT INTO public.audit_logs(actor_id, action, target_id, target_type, details)
    VALUES (p_actor_id, 'admin.role_changed', v_appointment.admin_id, 'profile',
      jsonb_build_object('appointment_id', p_appointment_id,
        'old_role', v_previous_role, 'new_role', 'student'));
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.finish_admin_appointment(uuid, uuid, public.appointment_status, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_admin_appointment(uuid, uuid, public.appointment_status, date, text) TO service_role;

-- Record the accepted invitation and the corresponding role assignment in the
-- same transaction as the existing one-time invitation claim.
CREATE OR REPLACE FUNCTION public.accept_admin_invitation(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email_confirmed_at timestamptz;
  v_appointment_id uuid;
  v_old_role public.user_role;
BEGIN
  IF coalesce(
       nullif(current_setting('request.jwt.claim.role', true), ''),
       nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
       ''
     ) <> 'service_role' THEN
    RAISE EXCEPTION 'Not authorized to accept admin invitations';
  END IF;

  SELECT email_confirmed_at INTO v_email_confirmed_at
  FROM auth.users WHERE id = p_user_id;
  IF v_email_confirmed_at IS NULL THEN RETURN false; END IF;

  SELECT id INTO v_appointment_id
  FROM public.admin_appointments
  WHERE admin_id = p_user_id
    AND status = 'pending_acceptance'
    AND invitation_accepted_at IS NULL
    AND invitation_sent_at >= now() - interval '24 hours'
  FOR UPDATE;
  IF v_appointment_id IS NULL THEN RETURN false; END IF;

  SELECT role INTO v_old_role FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  UPDATE public.profiles
  SET role = 'admin', updated_at = now()
  WHERE id = p_user_id AND role IN ('student', 'admin');
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.admin_appointments
  SET invitation_accepted_at = now(), updated_at = now()
  WHERE id = v_appointment_id
    AND invitation_accepted_at IS NULL
    AND status = 'pending_acceptance';
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation was already accepted'; END IF;

  INSERT INTO public.audit_logs(actor_id, action, target_id, target_type, details)
  VALUES (p_user_id, 'admin.invitation_accepted', v_appointment_id,
    'admin_appointment', jsonb_build_object('admin_id', p_user_id));
  IF v_old_role IS DISTINCT FROM 'admin'::public.user_role THEN
    INSERT INTO public.audit_logs(actor_id, action, target_id, target_type, details)
    VALUES (p_user_id, 'admin.role_changed', p_user_id, 'profile',
      jsonb_build_object('appointment_id', v_appointment_id,
        'old_role', v_old_role, 'new_role', 'admin'));
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_admin_invitation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_admin_invitation(uuid) TO service_role;

-- Keep appointment lifecycle events auditable even when an application action
-- cannot write its own best-effort log. The trigger is in the same transaction
-- as each appointment insert/status change.
CREATE OR REPLACE FUNCTION public.audit_admin_appointment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_actor_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'admin.invitation_created';
    v_actor_id := NEW.appointed_by;
    INSERT INTO public.audit_logs(actor_id, action, target_id, target_type, details)
    VALUES (v_actor_id, v_action, NEW.id, 'admin_appointment',
      jsonb_build_object('admin_id', NEW.admin_id, 'status', NEW.status));
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_action := CASE NEW.status
      WHEN 'active' THEN 'admin.appointment_activated'
      WHEN 'ended' THEN 'admin.appointment_closed'
      WHEN 'revoked' THEN 'admin.appointment_revoked'
      ELSE 'admin.appointment_status_changed'
    END;
    v_actor_id := CASE
      WHEN OLD.status = 'pending_acceptance' AND NEW.status = 'active' THEN NEW.admin_id
      ELSE NEW.appointed_by
    END;
    INSERT INTO public.audit_logs(actor_id, action, target_id, target_type, details)
    VALUES (v_actor_id, v_action, NEW.id, 'admin_appointment',
      jsonb_build_object('admin_id', NEW.admin_id,
        'from_status', OLD.status, 'to_status', NEW.status,
        'start_date', NEW.start_date, 'end_date', NEW.end_date,
        'reason', NEW.revocation_reason));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_admin_appointment_change ON public.admin_appointments;
CREATE TRIGGER trg_audit_admin_appointment_change
AFTER INSERT OR UPDATE ON public.admin_appointments
FOR EACH ROW EXECUTE FUNCTION public.audit_admin_appointment_change();

REVOKE ALL ON FUNCTION public.audit_admin_appointment_change() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.audit_presentation_schedule_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'presentation.scheduled';
    INSERT INTO public.audit_logs(actor_id, action, target_id, target_type, details)
    VALUES (NEW.scheduled_by, v_action, NEW.project_id, 'presentation',
      jsonb_build_object('scheduled_date', NEW.scheduled_date,
        'scheduled_time', NEW.scheduled_time, 'room', NEW.room));
    RETURN NEW;
  END IF;

  IF (OLD.scheduled_date, OLD.scheduled_time, OLD.room)
     IS DISTINCT FROM (NEW.scheduled_date, NEW.scheduled_time, NEW.room) THEN
    INSERT INTO public.audit_logs(actor_id, action, target_id, target_type, details)
    VALUES (NEW.scheduled_by, 'presentation.rescheduled', NEW.project_id, 'presentation',
      jsonb_build_object(
        'before', jsonb_build_object('scheduled_date', OLD.scheduled_date,
          'scheduled_time', OLD.scheduled_time, 'room', OLD.room),
        'after', jsonb_build_object('scheduled_date', NEW.scheduled_date,
          'scheduled_time', NEW.scheduled_time, 'room', NEW.room)));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_presentation_schedule_change ON public.presentations;
CREATE TRIGGER trg_audit_presentation_schedule_change
AFTER INSERT OR UPDATE ON public.presentations
FOR EACH ROW EXECUTE FUNCTION public.audit_presentation_schedule_change();

REVOKE ALL ON FUNCTION public.audit_presentation_schedule_change() FROM PUBLIC, anon, authenticated;
