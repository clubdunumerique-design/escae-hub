-- ESCAE-BÉNIN Innovation Hub — diagnostic des nominations administratives
-- À exécuter dans Supabase SQL Editor, sans droits d'écriture requis.
-- Ce fichier est strictement en lecture seule : commentaires et requêtes SELECT uniquement.
-- Aucun nom ni e-mail n'est retourné ; les identifiants techniques servent au rapprochement.
-- Pour exporter chaque résultat, exécuter les sections SELECT séparément dans le SQL Editor.

-- 0. Présence des tables et colonnes utiles (permet de repérer les écarts de schéma).
SELECT
  c.table_schema,
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable
FROM information_schema.columns AS c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'profiles',
    'admin_appointments',
    'admin_appointment_universities',
    'universities',
    'audit_logs'
  )
ORDER BY c.table_name, c.ordinal_position;

-- 1. Volumes des profils par rôle, puis total des profils administrateurs.
SELECT
  p.role::text AS profile_role,
  COUNT(*) AS profile_count
FROM public.profiles AS p
GROUP BY p.role::text
ORDER BY p.role::text;

SELECT
  COUNT(*) AS administrator_profile_count
FROM public.profiles AS p
WHERE p.role::text = 'admin';

-- 2. Nombre de nominations par statut.
SELECT
  a.status::text AS appointment_status,
  COUNT(*) AS appointment_count
FROM public.admin_appointments AS a
GROUP BY a.status::text
ORDER BY a.status::text;

-- 3. Liste des mandats actifs selon statut et dates (les dates NULL sont non bornées).
SELECT
  a.id AS appointment_id,
  a.admin_id,
  a.appointed_by,
  a.status::text AS appointment_status,
  a.start_date,
  a.end_date,
  a.invitation_sent_at,
  a.invitation_accepted_at,
  a.created_at,
  a.updated_at
FROM public.admin_appointments AS a
WHERE a.status::text = 'active'
  AND (a.start_date IS NULL OR a.start_date <= CURRENT_DATE)
  AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
ORDER BY a.start_date NULLS FIRST, a.id;

-- 4. Liste des nominations en attente d'acceptation.
SELECT
  a.id AS appointment_id,
  a.admin_id,
  a.appointed_by,
  a.status::text AS appointment_status,
  a.start_date,
  a.end_date,
  a.invitation_sent_at,
  a.invitation_accepted_at,
  a.created_at
FROM public.admin_appointments AS a
WHERE a.status::text = 'pending_acceptance'
ORDER BY a.invitation_sent_at NULLS FIRST, a.id;

-- 4b. Invitations en attente dont la fenêtre de validité de 24 heures est dépassée.
-- La durée reprend la règle de la fonction d'acceptation actuellement présente.
SELECT
  a.id AS appointment_id,
  a.admin_id,
  a.invitation_sent_at,
  a.invitation_sent_at + INTERVAL '24 hours' AS current_expiry_at,
  a.status::text AS appointment_status,
  a.invitation_accepted_at
FROM public.admin_appointments AS a
WHERE a.status::text = 'pending_acceptance'
  AND a.invitation_accepted_at IS NULL
  AND a.invitation_sent_at IS NOT NULL
  AND a.invitation_sent_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY a.invitation_sent_at, a.id;

-- 5. Mandats échus : état actif avec date de fin passée, ou état terminé avec date échue.
SELECT
  a.id AS appointment_id,
  a.admin_id,
  a.appointed_by,
  a.status::text AS appointment_status,
  a.start_date,
  a.end_date,
  a.invitation_accepted_at,
  a.updated_at
FROM public.admin_appointments AS a
WHERE a.status::text IN ('active', 'ended')
  AND a.end_date IS NOT NULL
  AND a.end_date < CURRENT_DATE
ORDER BY a.end_date, a.id;

-- 6. Mandats révoqués.
SELECT
  a.id AS appointment_id,
  a.admin_id,
  a.appointed_by,
  a.status::text AS appointment_status,
  a.start_date,
  a.end_date,
  a.invitation_accepted_at,
  a.revocation_reason,
  a.updated_at
FROM public.admin_appointments AS a
WHERE a.status::text = 'revoked'
ORDER BY a.updated_at DESC, a.id;

-- 7. Profils au rôle admin sans mandat accepté, en cours et dans sa période de validité.
SELECT
  p.id AS profile_id,
  p.role::text AS profile_role
FROM public.profiles AS p
WHERE p.role::text = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM public.admin_appointments AS a
    WHERE a.admin_id = p.id
      AND a.status::text = 'active'
      AND a.invitation_accepted_at IS NOT NULL
      AND (a.start_date IS NULL OR a.start_date <= CURRENT_DATE)
      AND (a.end_date IS NULL OR a.end_date >= CURRENT_DATE)
  )
ORDER BY p.id;

-- 8. Mandats marqués actifs sans acceptation enregistrée (anomalie).
SELECT
  a.id AS appointment_id,
  a.admin_id,
  a.appointed_by,
  a.start_date,
  a.end_date,
  a.invitation_sent_at,
  a.invitation_accepted_at,
  a.status::text AS appointment_status
FROM public.admin_appointments AS a
WHERE a.status::text = 'active'
  AND a.invitation_accepted_at IS NULL
ORDER BY a.start_date NULLS FIRST, a.id;

-- 9. Comptes liés à plusieurs nominations (total et nombre par état).
SELECT
  a.admin_id,
  COUNT(*) AS appointment_count,
  COUNT(*) FILTER (WHERE a.status::text = 'active') AS active_count,
  COUNT(*) FILTER (WHERE a.status::text = 'pending_acceptance') AS pending_count,
  COUNT(*) FILTER (WHERE a.status::text = 'ended') AS ended_count,
  COUNT(*) FILTER (WHERE a.status::text = 'revoked') AS revoked_count
FROM public.admin_appointments AS a
GROUP BY a.admin_id
HAVING COUNT(*) > 1
ORDER BY appointment_count DESC, a.admin_id;

-- 10. Plusieurs nominations ouvertes pour le même compte.
SELECT
  a.admin_id,
  COUNT(*) AS open_appointment_count,
  ARRAY_AGG(a.id ORDER BY a.created_at, a.id) AS appointment_ids,
  ARRAY_AGG(a.status::text ORDER BY a.created_at, a.id) AS appointment_statuses
FROM public.admin_appointments AS a
WHERE a.status::text IN ('pending_acceptance', 'active')
GROUP BY a.admin_id
HAVING COUNT(*) > 1
ORDER BY open_appointment_count DESC, a.admin_id;

-- 11. Chevauchements temporels entre mandats du même compte (tous statuts).
-- Les dates NULL sont traitées comme des bornes ouvertes. Les paires incohérentes
-- start_date > end_date sont exclues ici et présentées dans la section 12.
SELECT
  a.admin_id,
  a.id AS appointment_id_1,
  a.status::text AS status_1,
  a.start_date AS start_date_1,
  a.end_date AS end_date_1,
  b.id AS appointment_id_2,
  b.status::text AS status_2,
  b.start_date AS start_date_2,
  b.end_date AS end_date_2
FROM public.admin_appointments AS a
JOIN public.admin_appointments AS b
  ON b.admin_id = a.admin_id
 AND b.id > a.id
WHERE (a.start_date IS NULL OR a.end_date IS NULL OR a.start_date <= a.end_date)
  AND (b.start_date IS NULL OR b.end_date IS NULL OR b.start_date <= b.end_date)
  AND COALESCE(a.start_date, '-infinity'::date) <= COALESCE(b.end_date, 'infinity'::date)
  AND COALESCE(b.start_date, '-infinity'::date) <= COALESCE(a.end_date, 'infinity'::date)
ORDER BY a.admin_id, a.id, b.id;

-- 12. Incohérences de dates et de chronologie des invitations.
SELECT
  a.id AS appointment_id,
  a.admin_id,
  a.status::text AS appointment_status,
  a.start_date,
  a.end_date,
  a.invitation_sent_at,
  a.invitation_accepted_at,
  CASE
    WHEN a.start_date IS NOT NULL AND a.end_date IS NOT NULL AND a.start_date > a.end_date
      THEN 'start_date_after_end_date'
    WHEN a.invitation_accepted_at IS NOT NULL
      AND a.invitation_sent_at IS NOT NULL
      AND a.invitation_accepted_at < a.invitation_sent_at
      THEN 'accepted_before_invitation_sent'
    WHEN a.status::text = 'active' AND a.invitation_accepted_at IS NULL
      THEN 'active_without_acceptance'
    WHEN a.status::text = 'pending_acceptance' AND a.invitation_accepted_at IS NOT NULL
      THEN 'pending_but_already_accepted'
    WHEN a.status::text = 'revoked' AND a.revocation_reason IS NULL
      THEN 'revoked_without_reason'
  END AS anomaly_code
FROM public.admin_appointments AS a
WHERE (a.start_date IS NOT NULL AND a.end_date IS NOT NULL AND a.start_date > a.end_date)
   OR (a.invitation_accepted_at IS NOT NULL
       AND a.invitation_sent_at IS NOT NULL
       AND a.invitation_accepted_at < a.invitation_sent_at)
   OR (a.status::text = 'active' AND a.invitation_accepted_at IS NULL)
   OR (a.status::text = 'pending_acceptance' AND a.invitation_accepted_at IS NOT NULL)
   OR (a.status::text = 'revoked' AND a.revocation_reason IS NULL)
ORDER BY a.id;

-- 13. Contraintes déclarées sur profiles et admin_appointments.
SELECT
  ns.nspname AS schema_name,
  cls.relname AS table_name,
  con.conname AS constraint_name,
  CASE con.contype
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'c' THEN 'CHECK'
    WHEN 'x' THEN 'EXCLUDE'
    ELSE con.contype::text
  END AS constraint_type,
  pg_get_constraintdef(con.oid, true) AS definition,
  con.convalidated AS is_validated
FROM pg_constraint AS con
JOIN pg_class AS cls ON cls.oid = con.conrelid
JOIN pg_namespace AS ns ON ns.oid = cls.relnamespace
WHERE ns.nspname = 'public'
  AND cls.relname IN ('profiles', 'admin_appointments')
ORDER BY cls.relname, con.conname;

-- 14. Index et contraintes d'unicité, y compris les index partiels.
SELECT
  schemaname AS schema_name,
  tablename AS table_name,
  indexname AS index_name,
  indexdef AS definition
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'admin_appointments')
  AND (indexdef ILIKE '%UNIQUE%' OR indexdef ILIKE '%admin_appointments%')
ORDER BY tablename, indexname;

-- 15. État RLS des tables de gouvernance et profils.
SELECT
  ns.nspname AS schema_name,
  cls.relname AS table_name,
  cls.relrowsecurity AS rls_enabled,
  cls.relforcerowsecurity AS rls_forced
FROM pg_class AS cls
JOIN pg_namespace AS ns ON ns.oid = cls.relnamespace
WHERE ns.nspname = 'public'
  AND cls.relkind IN ('r', 'p')
  AND cls.relname IN (
    'profiles',
    'admin_appointments',
    'admin_appointment_universities',
    'audit_logs'
  )
ORDER BY cls.relname;

-- 16. Politiques RLS actuellement déclarées pour les tables de gouvernance.
SELECT
  schemaname AS schema_name,
  tablename AS table_name,
  policyname AS policy_name,
  permissive,
  roles,
  cmd AS command,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'admin_appointments',
    'admin_appointment_universities',
    'audit_logs'
  )
ORDER BY tablename, policyname;

-- 17. Fonctions PostgreSQL liées aux rôles, permissions, mandats et invitations.
-- La définition SQL/PLpgSQL est retournée pour permettre une revue des contrôles.
SELECT
  ns.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  pg_get_function_result(p.oid) AS result_type,
  p.prosecdef AS security_definer,
  p.proconfig AS function_settings,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc AS p
JOIN pg_namespace AS ns ON ns.oid = p.pronamespace
WHERE ns.nspname = 'public'
  AND (
    p.proname ILIKE '%admin%'
    OR p.proname ILIKE '%appointment%'
    OR p.proname ILIKE '%role%'
    OR p.proname ILIKE '%university%access%'
  )
ORDER BY p.proname, pg_get_function_identity_arguments(p.oid);

-- 18. Colonnes de périmètre multi-université déjà présentes, si elles existent.
-- Ce résultat ne suppose pas que les migrations de brouillon ont été appliquées.
SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns AS c
WHERE c.table_schema = 'public'
  AND (
    (c.table_name = 'admin_appointments'
      AND c.column_name IN ('university_id', 'access_scope', 'invitation_accepted_at'))
    OR (c.table_name = 'admin_appointment_universities'
      AND c.column_name IN ('appointment_id', 'university_id'))
  )
ORDER BY c.table_name, c.column_name;
