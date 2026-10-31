-- Read-only diagnostic for the approved UAC backfill.
-- Run this against the intended test database before any migration.
-- It returns aggregate counts only; it does not expose student names/emails or mutate data.

-- Existing row volumes and profile state.
SELECT
  count(*) AS profiles_total,
  count(*) FILTER (WHERE role = 'student') AS student_profiles,
  count(*) FILTER (WHERE role = 'student' AND student_id IS NULL) AS students_without_matricule,
  count(*) FILTER (WHERE role = 'student' AND is_verified) AS verified_students
FROM public.profiles;

-- Registry volume by status.
SELECT verification_status, count(*) AS records
FROM public.student_matricule_registry
GROUP BY verification_status
ORDER BY verification_status;

-- Normalized duplicate groups. These should be zero while the current global indexes exist.
SELECT 'profiles' AS source, count(*) AS duplicate_groups
FROM (
  SELECT upper(btrim(student_id)) AS normalized_matricule
  FROM public.profiles
  WHERE student_id IS NOT NULL
  GROUP BY upper(btrim(student_id))
  HAVING count(*) > 1
) duplicates
UNION ALL
SELECT 'student_matricule_registry', count(*)
FROM (
  SELECT upper(btrim(matricule)) AS normalized_matricule
  FROM public.student_matricule_registry
  GROUP BY upper(btrim(matricule))
  HAVING count(*) > 1
) duplicates;

-- Claims whose profile and registry fields disagree.
SELECT
  count(*) FILTER (WHERE p.id IS NULL) AS claimed_rows_without_profile,
  count(*) FILTER (
    WHERE p.id IS NOT NULL
      AND upper(btrim(p.student_id)) <> upper(btrim(r.matricule))
  ) AS matricule_mismatches,
  count(*) FILTER (
    WHERE p.id IS NOT NULL
      AND lower(btrim(p.email)) <> lower(btrim(r.email))
  ) AS email_mismatches,
  count(*) FILTER (WHERE p.id IS NOT NULL AND p.role <> 'student') AS claims_to_nonstudent_profiles,
  count(*) FILTER (
    WHERE p.id IS NOT NULL
      AND lower(regexp_replace(normalize(btrim(p.full_name), NFC), '[[:space:]]+', ' ', 'g'))
          <> lower(regexp_replace(normalize(btrim(r.full_name), NFC), '[[:space:]]+', ' ', 'g'))
  ) AS identity_mismatches
FROM public.student_matricule_registry r
LEFT JOIN public.profiles p ON p.id = r.claimed_by_user_id
WHERE r.claimed_by_user_id IS NOT NULL;

-- Profiles currently marked verified without an explicitly verified, matching claim.
SELECT count(*) AS verified_profiles_without_verified_matching_claim
FROM public.profiles p
WHERE p.role = 'student'
  AND p.is_verified
  AND NOT EXISTS (
    SELECT 1
    FROM public.student_matricule_registry r
    JOIN auth.users u ON u.id = p.id
    WHERE r.claimed_by_user_id = p.id
      AND r.verification_status = 'verified'
      AND upper(btrim(r.matricule)) = upper(btrim(p.student_id))
      AND lower(btrim(r.email)) = lower(btrim(u.email))
      AND lower(regexp_replace(normalize(btrim(r.full_name), NFC), '[[:space:]]+', ' ', 'g'))
          = lower(regexp_replace(normalize(btrim(p.full_name), NFC), '[[:space:]]+', ' ', 'g'))
      AND u.email_confirmed_at IS NOT NULL
  );

-- Project-to-owner relation health. The foreign key should make orphan counts zero.
SELECT
  count(*) AS projects_total,
  count(*) FILTER (WHERE p.id IS NULL) AS projects_without_owner_profile
FROM public.projects pr
LEFT JOIN public.profiles p ON p.id = pr.owner_id;

-- Existing nomination history and concurrent active mandates.
SELECT
  count(*) AS appointments_total,
  count(*) FILTER (WHERE status = 'active') AS active_appointments,
  count(DISTINCT admin_id) FILTER (WHERE status = 'active') AS distinct_active_admins,
  count(*) FILTER (WHERE status = 'pending_acceptance') AS pending_invitations
FROM public.admin_appointments;
