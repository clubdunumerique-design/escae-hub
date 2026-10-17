-- Enforce the official ETU-YYYY-NNNN format for new values and changes.
-- Existing rows are intentionally untouched; malformed historical rows can still
-- be reviewed, rejected, or corrected without blocking unrelated status updates.

CREATE OR REPLACE FUNCTION public.enforce_student_matricule_format()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.matricule IS DISTINCT FROM OLD.matricule THEN
    IF UPPER(BTRIM(NEW.matricule)) !~ '^ETU-[0-9]{4}-[0-9]{4}$' THEN
      RAISE EXCEPTION 'Format de matricule invalide. Format attendu : ETU-AAAA-NNNN.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_student_matricule_format_trigger
  ON public.student_matricule_registry;
CREATE TRIGGER enforce_student_matricule_format_trigger
BEFORE INSERT OR UPDATE ON public.student_matricule_registry
FOR EACH ROW EXECUTE FUNCTION public.enforce_student_matricule_format();

CREATE OR REPLACE FUNCTION public.enforce_profile_student_id_format()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.student_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.student_id IS DISTINCT FROM OLD.student_id)
     AND UPPER(BTRIM(NEW.student_id)) !~ '^ETU-[0-9]{4}-[0-9]{4}$' THEN
    RAISE EXCEPTION 'Format de matricule invalide. Format attendu : ETU-AAAA-NNNN.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_student_id_format_trigger ON public.profiles;
CREATE TRIGGER enforce_profile_student_id_format_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_student_id_format();
