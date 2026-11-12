# Local file preparation only. This script never connects to a database.
$ErrorActionPreference = 'Stop'
$schemaPath = Join-Path $PSScriptRoot 'zerohour_deployed_schema_export.csv'
if ((Get-FileHash -LiteralPath $schemaPath -Algorithm SHA256).Hash -ne 'EDD64E53B603DEA7991E43487039D9711DFE2BE080F25C027EB87A2626CE2AE1') {
  throw 'Schema export changed; review new definitions before regenerating.'
}
$migrationPath = Join-Path $PSScriptRoot '../migrations/202611050001_stage2_security.sql'
$migration = [IO.File]::ReadAllText($migrationPath)
$marker = '-- BEGIN RECOVERED RPCS'
$markerIndex = $migration.IndexOf($marker)
if ($markerIndex -ge 0) { $migration = $migration.Substring(0, $markerIndex) }
$rows = Import-Csv -LiteralPath $schemaPath
$definitions = @()
foreach ($functionName in @('claim_request', 'release_request', 'resolve_request')) {
  $row = @($rows | Where-Object { $_.section -eq '06_functions' -and $_.object_name.StartsWith('public.' + $functionName + '(') })
  if ($row.Count -ne 1) { throw "Expected one exported $functionName" }
  $definition = ($row[0].definition | ConvertFrom-Json).definition
  $guard = if ($functionName -eq 'resolve_request') {
    "`n  IF public.get_current_mentor_id() IS NULL THEN`n    RAISE EXCEPTION 'A non-anonymous staff identity is required' USING ERRCODE = '42501';`n  END IF;`n"
  } else {
    "`n  IF NOT public.is_organizer() THEN`n    RAISE EXCEPTION 'Only the Admin can allocate or release requests' USING ERRCODE = '42501';`n  END IF;`n"
  }
  $beginIndex = $definition.IndexOf('BEGIN')
  if ($beginIndex -lt 0) { throw 'Missing function body' }
  $definition = $definition.Insert($beginIndex + 5, $guard)
  $definition = $definition.Replace("SET search_path TO 'public', 'pg_temp'", "SET search_path TO ''")
  $definitions += $definition.TrimEnd() + ';'
}
$generated = $marker + "`n" + ($definitions -join "`n") + "`nCOMMIT;`n"
[IO.File]::WriteAllText($migrationPath, $migration + $generated, [Text.UTF8Encoding]::new($false))
Write-Output 'Prepared three recovered RPC bodies locally; no SQL executed.'

# Fail closed on function/policy drift BEFORE changing any deployed contracts.
$checks = @()
foreach ($row in $rows | Where-Object section -eq '06_functions') {
  $functionMetadata = $row.definition | ConvertFrom-Json
  $functionDefinition = $functionMetadata.definition
  $digest = [Convert]::ToHexString([Security.Cryptography.MD5]::HashData([Text.Encoding]::UTF8.GetBytes($functionDefinition))).ToLowerInvariant()
  $signature = ($row.object_name -replace '\bp_[a-z_]+\s+', '').Replace("'", "''")
  $checks += "  IF to_regprocedure('$signature') IS NULL OR md5(pg_get_functiondef(to_regprocedure('$signature'))) <> '$digest' THEN RAISE EXCEPTION 'Function drift: $signature'; END IF;"
  $aclJson = (ConvertTo-Json -InputObject @($functionMetadata.acl) -Compress).Replace("'", "''")
  $checks += "  IF (SELECT to_jsonb(coalesce(proacl,acldefault('f',proowner))) FROM pg_proc WHERE oid=to_regprocedure('$signature')) <> '$aclJson'::jsonb THEN RAISE EXCEPTION 'Function grant drift: $signature'; END IF;"
}
foreach ($row in $rows | Where-Object section -eq '05_policies') {
  $policy = $row.definition | ConvertFrom-Json
  $table = $policy.tablename.Replace("'", "''")
  $name = $policy.policyname.Replace("'", "''")
  $qual = ([string]$policy.qual).Replace("'", "''")
  $withCheck = ([string]$policy.with_check).Replace("'", "''")
  $checks += "  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='$table' AND policyname='$name' AND cmd='$($policy.cmd)' AND roles=ARRAY['authenticated']::name[] AND permissive='$($policy.permissive)' AND coalesce(qual,'')='$qual' AND coalesce(with_check,'')='$withCheck') THEN RAISE EXCEPTION 'Policy drift: $table / $name'; END IF;"
}
foreach ($row in $rows | Where-Object section -eq '02_columns') {
  $column = $row.definition | ConvertFrom-Json
  $parts = $row.object_name.Split('.')
  $table = $parts[0] + '.' + $parts[1]
  $name = $parts[2]
  $type = $column.type.Replace("'", "''")
  $notNull = if ($column.not_null) { 'true' } else { 'false' }
  $checks += "  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='$table'::regclass AND attname='$name' AND NOT attisdropped AND format_type(atttypid,atttypmod)='$type' AND attnotnull=$notNull) THEN RAISE EXCEPTION 'Column drift: $table.$name'; END IF;"
}
$preflight = @'
-- GENERATED REVIEW DRAFT: matches the supplied deployed schema snapshot.
-- No records or credentials are exported by this preflight. No mutation occurs.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.mentors, public.teams, public.requests, public.evaluations,
  public.team_sessions IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.prokind='f') <> 17 THEN
    RAISE EXCEPTION 'Unexpected public functions: review fresh export';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public') <> 23 THEN
    RAISE EXCEPTION 'Unexpected policies: review fresh export';
  END IF;
'@
$preflight += "`n" + ($checks -join "`n") + "`nEND `$`$;`nCOMMIT;`n"
[IO.File]::WriteAllText((Join-Path $PSScriptRoot '../migrations/202611050000_stage2_preflight.sql'), $preflight, [Text.UTF8Encoding]::new($false))
