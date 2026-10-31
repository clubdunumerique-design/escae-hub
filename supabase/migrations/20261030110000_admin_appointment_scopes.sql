-- Multi-university mandate scope. Existing mandates retain their history but
-- remain unscoped (NULL) until the director explicitly reviews and updates them.
-- An unscoped legacy mandate grants no data access.

ALTER TABLE public.admin_appointments
  ADD COLUMN IF NOT EXISTS university_id UUID,
  ADD COLUMN IF NOT EXISTS access_scope TEXT;

ALTER TABLE public.admin_appointments
  ALTER COLUMN university_id DROP NOT NULL,
  ALTER COLUMN access_scope DROP NOT NULL,
  ALTER COLUMN access_scope DROP DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.admin_appointments'::regclass
      AND conname = 'admin_appointments_university_id_fkey'
  ) THEN
    ALTER TABLE public.admin_appointments
      ADD CONSTRAINT admin_appointments_university_id_fkey
      FOREIGN KEY (university_id) REFERENCES public.universities(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

ALTER TABLE public.admin_appointments
  DROP CONSTRAINT IF EXISTS admin_appointments_access_scope_check;
ALTER TABLE public.admin_appointments
  ADD CONSTRAINT admin_appointments_access_scope_check
  CHECK (access_scope IS NULL OR access_scope IN ('own_university', 'all_universities'));

-- The old per-person global-open and platform-global-active limits do not fit
-- multiple mandates. A person may hold one open mandate per university.
DROP INDEX IF EXISTS public.idx_admin_appointments_unique_active;
DROP INDEX IF EXISTS public.idx_admin_appointments_single_active_strict;
DROP TRIGGER IF EXISTS trg_enforce_single_active_admin ON public.admin_appointments;
DROP FUNCTION IF EXISTS public.enforce_single_active_admin();
DROP INDEX IF EXISTS public.idx_admin_appointments_open_per_university;
-- Pending invitations are unique per account/university. Accepted mandates may
-- be renewed after expiry; their dates are checked by the director RPC instead.
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_appointments_pending_per_university
  ON public.admin_appointments (admin_id, university_id)
  WHERE status = 'pending_acceptance' AND university_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_appointments_user_status_dates
  ON public.admin_appointments (admin_id, status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_admin_appointments_university_status_dates
  ON public.admin_appointments (university_id, status, start_date, end_date);

-- Preserve director and own-record reads. Only the director may write mandates.
DROP POLICY IF EXISTS "director_creates_appointment" ON public.admin_appointments;
DROP POLICY IF EXISTS "director_updates_appointment" ON public.admin_appointments;
CREATE POLICY "director_creates_appointment"
  ON public.admin_appointments FOR INSERT TO authenticated
  WITH CHECK (public.has_role('director') AND appointed_by = auth.uid());
CREATE POLICY "director_updates_appointment"
  ON public.admin_appointments FOR UPDATE TO authenticated
  USING (public.has_role('director'))
  WITH CHECK (public.has_role('director'));

-- Rollback: do not restore the single-admin constraint or invent legacy scopes.
-- Keep NULL-scoped historical rows and this schema until a reviewed forward
-- migration resolves each legacy mandate or a verified backup is restored.
