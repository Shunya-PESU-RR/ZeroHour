// Never log a Supabase error object, RPC arguments, session, user, or response.
// Error messages/details can contain database values; inspect only to classify.
const stages = new Set(['configuration', 'input', 'anonymous_sign_in', 'login_team', 'get_session', 'get_my_team', 'sign_out', 'routing']);
const outcomes = new Set(['started', 'succeeded', 'failed', 'empty_result', 'missing_session', 'invalid_response', 'rejected_input']);
const codes = new Set([
  'anonymous_provider_disabled', 'signup_disabled', 'captcha_failed',
  'over_request_rate_limit', 'session_expired', 'refresh_token_not_found',
  'refresh_token_already_used', 'bad_jwt', 'invalid_credentials', 'user_banned',
  'unexpected_failure', 'validation_failed', 'request_timeout',
  'PGRST202', 'PGRST301', 'PGRST302', 'PGRST204',
  '42501', '42883', '42703', '42702', '23503', '23505', 'P0001',
]);

export function safeTeamDiagnostic(stage, outcome, error) {
  const status = Number(error?.status);
  const message = typeof error?.message === 'string' ? error.message : '';
  let category = 'unspecified';
  if (/failed to fetch|fetch failed|networkerror|network request failed/i.test(message)) category = 'network';
  else if (/invalid team session/i.test(message)) category = 'anonymous_session_rejected';
  else if (error?.code === 'captcha_failed') category = 'captcha';
  else if (error?.code === 'anonymous_provider_disabled') category = 'anonymous_sign_in_disabled';
  else if (['PGRST202', '42883'].includes(error?.code)) category = 'rpc_not_available';
  else if (error?.code === '42501') category = 'permission_denied';
  return {
    stage: stages.has(stage) ? stage : 'unknown_stage',
    outcome: outcomes.has(outcome) ? outcome : 'unknown_outcome',
    status: Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
    code: codes.has(error?.code) ? error.code : error?.code ? 'unrecognized_code' : null,
    category,
  };
}

export function logTeamAccess(stage, outcome, error) {
  if (import.meta.env?.DEV) {
    console.debug('[ZeroHour team access]', JSON.stringify(safeTeamDiagnostic(stage, outcome, error)));
  }
}

export function teamAccessFailureMessage(stage, error) {
  const diagnostic = safeTeamDiagnostic(stage, 'failed', error);
  if (diagnostic.status === 429) return 'Too many sign-in attempts. Please wait before trying again.';
  if (diagnostic.category === 'network') return 'Could not reach the team sign-in service. Check your connection and try again.';
  if (diagnostic.category === 'anonymous_sign_in_disabled') return 'Team sign-in is unavailable. Ask an organizer to check anonymous sign-in.';
  if (diagnostic.category === 'captcha') return 'Anonymous sign-in requires CAPTCHA verification. Please contact an organizer.';
  if (diagnostic.category === 'anonymous_session_rejected') return 'Your anonymous team session was not accepted. Please sign in again.';
  if (diagnostic.category === 'rpc_not_available') return 'The team service is unavailable. Please contact an organizer.';
  if (stage === 'get_session') return 'Your team session could not be restored. Return to Team Login and try again.';
  if (stage === 'get_my_team') return 'Could not load your team workspace. Please retry or return to Team Login.';
  if (stage === 'anonymous_sign_in') return 'Could not start a team sign-in session. Please try again or contact an organizer.';
  return 'Team verification failed. Please try again or contact an organizer.';
}

export function isTeamIdentity(value) {
  return Boolean(value && typeof value.team_id === 'string' && value.team_id &&
    typeof value.team_name === 'string' && Number.isInteger(value.table_number));
}
