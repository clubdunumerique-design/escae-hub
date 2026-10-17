-- Améliorer le rapprochement des noms d'étudiants et permettre la recherche automatique par email
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
  ), common_tokens AS (
    SELECT ARRAY(
      SELECT unnest(r.tokens)
      INTERSECT
      SELECT unnest(p.tokens)
    ) AS tokens
    FROM registry_tokens r CROSS JOIN profile_tokens p
  )
  SELECT (
    -- Cas 1 : Au moins 2 mots communs (ex: ordre inversé nom/prénoms, prénoms multiples)
    cardinality(c.tokens) >= 2
    OR
    -- Cas 2 : Tous les mots du profil sont dans le registre (ex: profil = "DOSSA", registre = "Steeve DOSSA")
    (cardinality(p.tokens) >= 1 AND p.tokens <@ r.tokens)
    OR
    -- Cas 3 : Tous les mots du registre sont dans le profil (ex: registre = "Lydie ADJOLOHOUN", profil = "ADJOLOHOUN Lydie de L'Eucharistie...")
    (cardinality(r.tokens) >= 1 AND r.tokens <@ p.tokens)
  )
  FROM registry_tokens r CROSS JOIN profile_tokens p CROSS JOIN common_tokens c;
$$;

REVOKE ALL ON FUNCTION public.student_registry_name_matches(text, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_student_matricule(
  p_user_id uuid,
  p_matricule text DEFAULT NULL
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

  -- Si le matricule n'a pas été fourni, rechercher la fiche collectée correspondante par email
  IF v_matricule = '' THEN
    SELECT upper(btrim(matricule))
      INTO v_matricule
      FROM public.student_matricule_registry
      WHERE lower(btrim(email)) = v_email
        AND verification_status <> 'rejected'
      ORDER BY (claimed_by_user_id = p_user_id) DESC, submitted_at DESC
      LIMIT 1;
  END IF;

  IF v_matricule !~ '^ETU-[0-9]{4}-[0-9]{4}$' THEN
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
