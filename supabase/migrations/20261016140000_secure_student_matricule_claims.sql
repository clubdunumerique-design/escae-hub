-- Security hardening for automatic student matricule matching.
-- A public registry row is a collected record, not an official school certification.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.student_matricule_registry
    WHERE claimed_by_user_id IS NOT NULL
    GROUP BY claimed_by_user_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate student registry claims exist; reconcile them before applying this migration.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE student_id IS NOT NULL
    GROUP BY upper(btrim(student_id)) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate profile matricules exist; reconcile them before applying this migration.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.student_matricule_registry r
    JOIN public.profiles p ON p.id = r.claimed_by_user_id
    WHERE p.student_id IS NOT NULL
      AND upper(btrim(p.student_id)) <> upper(btrim(r.matricule))
  ) THEN
    RAISE EXCEPTION 'Conflicting existing profile/registry matricule links exist; reconcile them before applying this migration.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_registry_one_claim_per_user
  ON public.student_matricule_registry (claimed_by_user_id)
  WHERE claimed_by_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_student_id_normalized_unique
  ON public.profiles (upper(btrim(student_id)))
  WHERE student_id IS NOT NULL;

-- Revoke stale verification flags that cannot be supported by a confirmed email
-- and an exact collected-record match. Preserve all registry/profile data and links.
UPDATE public.profiles p
SET is_verified = false,
    updated_at = now()
WHERE p.role = 'student'
  AND p.is_verified
  AND NOT EXISTS (
    SELECT 1
    FROM public.student_matricule_registry r
    JOIN auth.users u ON u.id = p.id
    WHERE r.claimed_by_user_id = p.id
      AND upper(btrim(r.matricule)) = upper(btrim(p.student_id))
      AND lower(btrim(r.email)) = lower(btrim(u.email))
      AND lower(regexp_replace(normalize(btrim(r.full_name), NFC), '[[:space:]]+', ' ', 'g'))
          = lower(regexp_replace(normalize(btrim(p.full_name), NFC), '[[:space:]]+', ' ', 'g'))
      AND u.email_confirmed_at IS NOT NULL
      AND r.verification_status <> 'rejected'
  );

-- Prevent normal authenticated clients from writing security-sensitive profile fields
-- or directly mutating the registry. Server actions use the server-only service client.
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.student_matricule_registry FROM anon, authenticated;

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

  IF length(v_matricule) < 3 OR length(v_matricule) > 30
     OR v_matricule !~ '^[A-Z0-9._/-]+$' THEN
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
         lower(btrim(email)),
         lower(regexp_replace(normalize(btrim(full_name), NFC), '[[:space:]]+', ' ', 'g'))
    INTO v_registry_id, v_registry_claim, v_department, v_registry_email, v_registry_name
    FROM public.student_matricule_registry
    WHERE upper(btrim(matricule)) = v_matricule
      AND verification_status <> 'rejected'
    FOR UPDATE;

  IF v_registry_id IS NULL
     OR v_registry_claim IS NOT NULL AND v_registry_claim <> p_user_id
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

REVOKE ALL ON FUNCTION public.claim_student_matricule(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_student_matricule(uuid, text) TO service_role;

-- A modest database-backed limiter for the public collection endpoint.
CREATE TABLE IF NOT EXISTS public.public_matricule_rate_limits (
  ip_hash text NOT NULL,
  window_started_at timestamptz NOT NULL,
  submission_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, window_started_at),
  CHECK (ip_hash ~ '^[a-f0-9]{64}$'),
  CHECK (submission_count >= 0)
);

ALTER TABLE public.public_matricule_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_matricule_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.public_matricule_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_public_matricule_rate_limit(p_ip_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window timestamptz := date_trunc('hour', now())
    + floor(extract(minute FROM now()) / 10) * interval '10 minutes';
  v_count integer;
BEGIN
  IF coalesce(
       nullif(current_setting('request.jwt.claim.role', true), ''),
       nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
       ''
     ) <> 'service_role'
     OR p_ip_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Not authorized to consume public matricule rate limit';
  END IF;

  DELETE FROM public.public_matricule_rate_limits
  WHERE window_started_at < now() - interval '24 hours';

  INSERT INTO public.public_matricule_rate_limits(ip_hash, window_started_at, submission_count)
  VALUES (p_ip_hash, v_window, 1)
  ON CONFLICT (ip_hash, window_started_at) DO UPDATE
    SET submission_count = public.public_matricule_rate_limits.submission_count + 1
    WHERE public.public_matricule_rate_limits.submission_count < 5
  RETURNING submission_count INTO v_count;

  RETURN v_count IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_public_matricule_rate_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_public_matricule_rate_limit(text) TO service_role;
