-- Admin privileges are granted only when the invited account redeems its
-- one-time Supabase invitation link with a confirmed email session.
CREATE OR REPLACE FUNCTION public.accept_admin_invitation(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email_confirmed_at timestamptz;
  v_appointment_id uuid;
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
  IF v_email_confirmed_at IS NULL THEN
    RETURN false;
  END IF;

  SELECT id INTO v_appointment_id
  FROM public.admin_appointments
  WHERE admin_id = p_user_id
    AND status = 'pending_acceptance'
    AND invitation_accepted_at IS NULL
    AND invitation_sent_at >= now() - interval '24 hours'
  FOR UPDATE;
  IF v_appointment_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
  SET role = 'admin', updated_at = now()
  WHERE id = p_user_id AND role IN ('student', 'admin');
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.admin_appointments
  SET invitation_accepted_at = now(), updated_at = now()
  WHERE id = v_appointment_id
    AND invitation_accepted_at IS NULL
    AND status = 'pending_acceptance';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation was already accepted';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_admin_invitation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_admin_invitation(uuid) TO service_role;
