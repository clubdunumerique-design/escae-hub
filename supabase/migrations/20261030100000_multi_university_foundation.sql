
-- Draft for review; do not apply until the read-only preflight report is reviewed.
-- Adds the two institutions, backfills existing student and registry rows to UAC,
-- and scopes matricule uniqueness to the institution.
-- Data retained: no profile, registry, project, or history rows are deleted.

-- Fail closed until the known integrity anomalies have been reconciled.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE student_id IS NOT NULL
    GROUP BY upper(btrim(student_id)) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Preflight required: duplicate normalized profile matricules exist.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.student_matricule_registry
    GROUP BY upper(btrim(matricule)) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Preflight required: duplicate normalized registry matricules exist.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.student_matricule_registry r
    JOIN public.profiles p ON p.id = r.claimed_by_user_id
    WHERE p.student_id IS NOT NULL
      AND upper(btrim(p.student_id)) <> upper(btrim(r.matricule))
  ) THEN
    RAISE EXCEPTION 'Preflight required: claimed profile and registry matricules disagree.';
  END IF;

  -- Legacy claimed records: keep role, email and matricule checks.
  -- Name differences are tolerated because existing records may use
  -- different name orders, abbreviations or additional given names.
  IF EXISTS (
    SELECT 1
    FROM public.student_matricule_registry r
    JOIN public.profiles p ON p.id = r.claimed_by_user_id
    WHERE p.role <> 'student'
       OR lower(btrim(p.email)) <> lower(btrim(r.email))
  ) THEN
    RAISE EXCEPTION 'Preflight required: claimed profiles have role or email mismatches.';
  END IF;

  -- Verified profiles must still have an explicitly verified claim,
  -- a matching matricule, matching Auth email and confirmed email.
  -- Exact full-name equality is not required for legacy records.
  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.role = 'student' AND p.is_verified
      AND NOT EXISTS (
        SELECT 1
        FROM public.student_matricule_registry r
        JOIN auth.users u ON u.id = p.id
        WHERE r.claimed_by_user_id = p.id
          AND r.verification_status = 'verified'
          AND upper(btrim(r.matricule)) = upper(btrim(p.student_id))
          AND lower(btrim(r.email)) = lower(btrim(u.email))
          AND lower(btrim(p.email)) = lower(btrim(u.email))
          AND u.email_confirmed_at IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'Preflight required: verified profiles lack an explicitly verified matching claim.';
  END IF;
END;
$$;

-- New Auth users select an active university; role still defaults strictly to student.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_university_id UUID;
BEGIN
  BEGIN
    v_university_id := nullif(NEW.raw_user_meta_data->>'university_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'An active university must be selected at signup.';
  END;

  IF v_university_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.universities
    WHERE id = v_university_id AND is_active
  ) THEN
    RAISE EXCEPTION 'An active university must be selected at signup.';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, university_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Nouvel Utilisateur'),
    'student'::public.user_role,
    v_university_id
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  RETURN NEW;
END;
$$;

-- If this table already exists, fail closed when its shape is not the expected
-- stable-ID reference. CREATE TABLE IF NOT EXISTS would otherwise hide drift.
DO $$
BEGIN
  IF to_regclass('public.universities') IS NOT NULL AND EXISTS (
    SELECT 1
    FROM (VALUES
      ('id', 'uuid'),
      ('code', 'text'),
      ('name', 'text'),
      ('is_active', 'boolean'),
      ('created_at', 'timestamp with time zone')
    ) AS expected(column_name, data_type)
    LEFT JOIN information_schema.columns c
      ON c.table_schema = 'public'
     AND c.table_name = 'universities'
     AND c.column_name = expected.column_name
     AND c.data_type = expected.data_type
    WHERE c.column_name IS NULL
  ) THEN
    RAISE EXCEPTION 'Preflight required: public.universities has an incompatible schema.';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.universities (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT universities_code_format CHECK (code ~ '^[a-z0-9-]+$')
);

-- Stable UUIDs: 00000000-0000-4000-8000-000000000001 = UAC;
--              00000000-0000-4000-8000-000000000002 = Université de Porto-Novo.
-- Refuse either a code mapped to a different UUID or a reserved UUID used by
-- another code. Never silently retain or replace an ambiguous mapping.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.universities
    WHERE (code = 'uac' AND id <> '00000000-0000-4000-8000-000000000001'::uuid)
       OR (code = 'upn' AND id <> '00000000-0000-4000-8000-000000000002'::uuid)
       OR (id = '00000000-0000-4000-8000-000000000001'::uuid AND code <> 'uac')
       OR (id = '00000000-0000-4000-8000-000000000002'::uuid AND code <> 'upn')
  ) THEN
    RAISE EXCEPTION 'Preflight required: university code/stable UUID conflict.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.universities GROUP BY id HAVING count(*) > 1)
     OR EXISTS (SELECT 1 FROM public.universities GROUP BY code HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Preflight required: duplicate university IDs or codes exist.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_universities_stable_id_unique
  ON public.universities (id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_universities_code_unique
  ON public.universities (code);

INSERT INTO public.universities (id, code, name)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'uac', 'Université d''Abomey-Calavi'),
  ('00000000-0000-4000-8000-000000000002', 'upn', 'Université de Porto-Novo')
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name
  WHERE public.universities.code = EXCLUDED.code;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS university_id UUID;
ALTER TABLE public.student_matricule_registry
  ADD COLUMN IF NOT EXISTS university_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_university_id_fkey') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_university_id_fkey
      FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.student_matricule_registry'::regclass AND conname = 'student_matricule_registry_university_id_fkey') THEN
    ALTER TABLE public.student_matricule_registry ADD CONSTRAINT student_matricule_registry_university_id_fkey
      FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

-- Confirmed legacy ownership: all existing student profiles and registry entries
-- belong to UAC. Porto-Novo intentionally receives no historical rows.
UPDATE public.profiles
SET university_id = '00000000-0000-4000-8000-000000000001'
WHERE role = 'student';

UPDATE public.student_matricule_registry
SET university_id = '00000000-0000-4000-8000-000000000001';

ALTER TABLE public.student_matricule_registry
  ALTER COLUMN university_id SET NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_student_requires_university;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_student_requires_university
  CHECK (role <> 'student' OR university_id IS NOT NULL) NOT VALID;
ALTER TABLE public.profiles
  VALIDATE CONSTRAINT profiles_student_requires_university;

-- Replace global matricule uniqueness after the legacy data has passed preflight.
DROP INDEX IF EXISTS public.idx_student_registry_matricule_unique;
DROP INDEX IF EXISTS public.idx_profiles_student_id_normalized_unique;

CREATE UNIQUE INDEX idx_student_registry_university_matricule_unique
  ON public.student_matricule_registry (university_id, (upper(btrim(matricule))));

CREATE UNIQUE INDEX idx_profiles_university_student_id_normalized_unique
  ON public.profiles (university_id, (upper(btrim(student_id))))
  WHERE student_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_university_id
  ON public.profiles (university_id) WHERE role = 'student';
CREATE INDEX IF NOT EXISTS idx_registry_university_status
  ON public.student_matricule_registry (university_id, verification_status);

ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.universities FROM anon, authenticated;
GRANT SELECT ON public.universities TO anon, authenticated;
DROP POLICY IF EXISTS "Public reads active universities" ON public.universities;
CREATE POLICY "Public reads active universities"
  ON public.universities FOR SELECT TO anon, authenticated
  USING (is_active);

-- Rollback note (manual): restore the global indexes only after proving there are
-- no cross-university normalized matricule duplicates. Do not delete university rows.
