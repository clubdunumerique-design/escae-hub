-- Match a student's collected record to the Hub profile without depending on
-- whether first and last names were entered in the same order. Extra given
-- names on the profile are allowed; email and matricule must still match.
CREATE OR REPLACE FUNCTION public.student_registry_name_matches(
  p_registry_name text,
  p_profile_name text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  WITH registry_tokens AS (
    SELECT ARRAY(
      SELECT DISTINCT token
      FROM regexp_split_to_table(
        lower(regexp_replace(normalize(btrim(p_registry_name), NFC), '[^[:alnum:]]+', ' ', 'g')),
        '[[:space:]]+'
      ) AS split(token)
      WHERE split.token <> ''
      ORDER BY split.token
    ) AS tokens
  ), profile_tokens AS (
    SELECT ARRAY(
      SELECT DISTINCT token
      FROM regexp_split_to_table(
        lower(regexp_replace(normalize(btrim(p_profile_name), NFC), '[^[:alnum:]]+', ' ', 'g')),
        '[[:space:]]+'
      ) AS split(token)
      WHERE split.token <> ''
      ORDER BY split.token
    ) AS tokens
  )
  SELECT cardinality(registry_tokens.tokens) >= 2
     AND registry_tokens.tokens <@ profile_tokens.tokens
  FROM registry_tokens CROSS JOIN profile_tokens;
$$;

REVOKE ALL ON FUNCTION public.student_registry_name_matches(text, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_student_matricule(
  p_user_id uuid,
  p_matricule text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
  v_email_confirmed_at timestamptz;
  v_full_name text;
  v_role text;
  v_existing_student_id text;
  v_is_verified boolean;
  v_registry_id uuid;
  v_registry_claim uuid;
  v_department text;
  v_matricule text := upper(btrim(coalesce(p_matricule, '')));
  v_registry_email text;
  v_registry_name text;
BEGIN
  IF coalesce(
       nullif(current_setting('request.jwt.claim.role', true), ''),
       nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
       ''
     ) <> 'service_role' THEN
    RAISE EXCEPTION 'Not authorized to claim student matricules';
  END IF;

  IF v_matricule !~ '^ETU-[0-9]{4}-[0-9]{4}$' THEN
    RETURN false;
  END IF;

  SELECT lower(btrim(email)), email_confirmed_at
    INTO v_email, v_email_confirmed_at
    FROM auth.users
    WHERE id = p_user_id;

  IF v_email IS NULL OR v_email_confirmed_at IS NULL THEN
    RETURN false;
  END IF;

  SELECT role::text, full_name, student_id, is_verified
    INTO v_role, v_full_name, v_existing_student_id, v_is_verified
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

  IF v_role IS DISTINCT FROM 'student' THEN
    RETURN false;
  END IF;

  IF v_existing_student_id IS NOT NULL
     AND upper(btrim(v_existing_student_id)) <> v_matricule THEN
    RETURN false;
  END IF;

  SELECT id, claimed_by_user_id, field_of_study,
         lower(btrim(email)), full_name
    INTO v_registry_id, v_registry_claim, v_department, v_registry_email, v_registry_name
    FROM public.student_matricule_registry
    WHERE upper(btrim(matricule)) = v_matricule
      AND verification_status <> 'rejected'
    FOR UPDATE;

  IF v_registry_id IS NULL
     OR (v_registry_claim IS NOT NULL AND v_registry_claim <> p_user_id)
     OR v_registry_email <> v_email
     OR NOT public.student_registry_name_matches(v_registry_name, v_full_name) THEN
    RETURN false;
  END IF;

  UPDATE public.student_matricule_registry
    SET claimed_by_user_id = p_user_id,
        claimed_at = coalesce(claimed_at, now()),
        updated_at = now()
    WHERE id = v_registry_id
      AND (claimed_by_user_id IS NULL OR claimed_by_user_id = p_user_id);

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.profiles
    SET student_id = v_matricule,
        is_verified = true,
        department = coalesce(v_department, department),
        updated_at = now()
    WHERE id = p_user_id
      AND (student_id IS NULL OR upper(btrim(student_id)) = v_matricule);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile matricule changed during claim';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_student_matricule(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_student_matricule(uuid, text)
  TO service_role;
