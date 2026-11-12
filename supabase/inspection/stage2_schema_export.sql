-- INSPECTION ONLY. Run in the deployed project's Supabase SQL Editor.
-- Export the result as CSV. This transaction performs no writes and reads no
-- application rows, auth.users, access codes, tokens, or password catalogs.
-- Function bodies/default expressions are schema: inspect the exported file
-- locally for hardcoded secrets before sharing it. Redact secret VALUES only.
BEGIN TRANSACTION READ ONLY;

WITH app_schemas AS (
  SELECT oid, nspname
  FROM pg_namespace
  WHERE nspname NOT LIKE 'pg_%'
    AND nspname <> 'information_schema'
    AND nspname NOT IN (
      'auth', 'storage', 'realtime', 'extensions', 'graphql', 'graphql_public',
      'vault', 'net', 'pgbouncer', 'supabase_functions', 'supabase_migrations'
    )
), app_relations AS (
  SELECT c.*, n.nspname
  FROM pg_class c JOIN app_schemas n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
), metadata AS (
  SELECT '01_relations' AS section, c.nspname || '.' || c.relname AS object_name,
    jsonb_build_object(
      'schema', c.nspname, 'name', c.relname, 'kind', c.relkind,
      'owner', pg_get_userbyid(c.relowner), 'rls_enabled', c.relrowsecurity,
      'rls_forced', c.relforcerowsecurity, 'acl', c.relacl,
      'options', c.reloptions,
      'view_definition', CASE WHEN c.relkind IN ('v', 'm') THEN pg_get_viewdef(c.oid, true) END
    ) AS definition
  FROM app_relations c
  UNION ALL
  SELECT '02_columns', c.nspname || '.' || c.relname || '.' || a.attname,
    jsonb_build_object(
      'position', a.attnum, 'type', format_type(a.atttypid, a.atttypmod),
      'not_null', a.attnotnull, 'identity', a.attidentity,
      'generated', a.attgenerated, 'acl', a.attacl,
      'default', pg_get_expr(d.adbin, d.adrelid)
    )
  FROM app_relations c
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
  UNION ALL
  SELECT '03_constraints', n.nspname || '.' || co.conname,
    jsonb_build_object(
      'table', co.conrelid::regclass::text, 'type', co.contype,
      'validated', co.convalidated, 'deferrable', co.condeferrable,
      'definition', pg_get_constraintdef(co.oid, true)
    )
  FROM pg_constraint co JOIN app_schemas n ON n.oid = co.connamespace
  UNION ALL
  SELECT '04_indexes', i.schemaname || '.' || i.indexname,
    jsonb_build_object('table', i.tablename, 'definition', i.indexdef)
  FROM pg_indexes i JOIN app_schemas n ON n.nspname = i.schemaname
  UNION ALL
  SELECT '05_policies', p.schemaname || '.' || p.tablename || '.' || p.policyname,
    to_jsonb(p)
  FROM pg_policies p JOIN app_schemas n ON n.nspname = p.schemaname
  UNION ALL
  SELECT '06_functions', n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
    jsonb_build_object(
      'owner', pg_get_userbyid(p.proowner), 'security_definer', p.prosecdef,
      'config_including_search_path', p.proconfig,
      'acl', COALESCE(p.proacl, acldefault('f', p.proowner)),
      'definition', pg_get_functiondef(p.oid)
    )
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.prokind IN ('f', 'p') AND (
    n.oid IN (SELECT oid FROM app_schemas)
    OR p.proname IN ('login_team', 'get_my_team')
    OR p.oid IN (
      SELECT t.tgfoid FROM pg_trigger t
      WHERE NOT t.tgisinternal AND t.tgrelid IN (SELECT oid FROM app_relations)
    )
  )
  UNION ALL
  SELECT '07_triggers', n.nspname || '.' || c.relname || '.' || t.tgname,
    jsonb_build_object(
      'enabled', t.tgenabled, 'function', t.tgfoid::regprocedure::text,
      'definition', pg_get_triggerdef(t.oid, true)
    )
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE NOT t.tgisinternal AND (
    n.oid IN (SELECT oid FROM app_schemas)
    OR (n.nspname = 'auth' AND c.relname = 'users')
  )
  UNION ALL
  SELECT '08_schema_grants', n.nspname,
    jsonb_build_object('owner', pg_get_userbyid(n.nspowner), 'acl', n.nspacl)
  FROM pg_namespace n WHERE n.oid IN (SELECT oid FROM app_schemas)
  UNION ALL
  SELECT '09_default_grants', pg_get_userbyid(d.defaclrole) || ':' || d.defaclnamespace::text || ':' || d.defaclobjtype::text,
    jsonb_build_object(
      'owner', pg_get_userbyid(d.defaclrole), 'schema', n.nspname,
      'object_type', d.defaclobjtype, 'acl', d.defaclacl
    )
  FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
  WHERE d.defaclnamespace = 0 OR n.oid IN (SELECT oid FROM app_schemas)
  UNION ALL
  SELECT '10_custom_types', n.nspname || '.' || t.typname,
    jsonb_build_object('kind', t.typtype, 'enum_values', (
      SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid = t.oid
    ), 'domain_base_type', CASE WHEN t.typtype = 'd' THEN format_type(t.typbasetype, t.typtypmod) END)
  FROM pg_type t JOIN app_schemas n ON n.oid = t.typnamespace
  WHERE t.typtype IN ('e', 'd')
  UNION ALL
  SELECT '11_realtime_publication', p.pubname || '.' || p.schemaname || '.' || p.tablename,
    to_jsonb(p)
  FROM pg_publication_tables p JOIN app_schemas n ON n.nspname = p.schemaname
  UNION ALL
  SELECT '12_role_flags', r.rolname,
    jsonb_build_object('can_login', r.rolcanlogin, 'superuser', r.rolsuper, 'bypass_rls', r.rolbypassrls, 'inherit', r.rolinherit)
  FROM pg_roles r WHERE r.rolname NOT LIKE 'pg_%'
  UNION ALL
  SELECT '13_role_memberships', pg_get_userbyid(m.roleid) || ':' || pg_get_userbyid(m.member),
    jsonb_build_object('role', pg_get_userbyid(m.roleid), 'member', pg_get_userbyid(m.member), 'admin_option', m.admin_option)
  FROM pg_auth_members m
)
SELECT section, object_name, definition FROM metadata ORDER BY section, object_name;

COMMIT;
