import { useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { DEFAULT_CRITERIA, MAX_SCORE } from '../config/rubric';
import { requireOperationsWrites } from '../config/operations';

const emptyCache = {
  teams: [], mentors: [], requests: [], evaluations: [], submittedEvaluations: [], loading: true, error: null,
};
let cache = emptyCache;
let staffSession = null;
let nextChannel = 0;
const listeners = new Set();

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setCache(next) {
  cache = next;
  listeners.forEach((listener) => listener());
}

export function useData(getter) {
  return useSyncExternalStore(subscribe, getter);
}

export const selectTeams = () => cache.teams;
export const selectMentors = () => cache.mentors;
export const selectRequests = () => cache.requests;
export const selectEvaluations = () => cache.evaluations;
export const selectLoading = () => cache.loading;
export const selectError = () => cache.error;
export const selectSubmittedEvaluations = () => cache.submittedEvaluations;

function requireStaff() {
  if (!staffSession) throw new Error('Sign in with a linked staff account.');
  return staffSession;
}

// Consistent database to frontend mapping functions
export function mapTeam(t) {
  return {
    id: t.id,
    name: t.name,
    table: t.table_number,
  };
}

export function mapMentor(m) {
  return {
    id: m.id,
    name: m.name,
    role: m.role,
    userId: m.user_id,
  };
}

export function mapRequest(r) {
  return {
    id: r.id,
    table: r.table_number,
    issue: r.issue,
    status: r.cancelled_at ? 'cancelled' : r.status === 'claimed' && r.progress_at ? 'in_progress' : r.status,
    claimedBy: r.claimed_by,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : null,
    claimedAt: r.claimed_at ? new Date(r.claimed_at).getTime() : null,
    resolvedAt: r.resolved_at ? new Date(r.resolved_at).getTime() : null,
  };
}

export function mapEvaluation(e) {
  return {
    id: e.id,
    teamId: e.team_id,
    mentorId: e.mentor_id,
    scores: e.scores || {},
    comment: e.comment || '',
    status: e.status,
    updatedAt: e.updated_at ? new Date(e.updated_at).getTime() : null,
    submittedAt: e.submitted_at ? new Date(e.submitted_at).getTime() : null,
  };
}


async function refreshData(session) {
  if (staffSession !== session) return;
  const revision = ++session.revision;
  const isCurrent = () => staffSession === session && session.revision === revision;
  try {
    let results;
    if (session.role === 'organizer') {
      results = await Promise.all([
        supabase.from('teams').select('id, name, table_number').order('table_number'),
        supabase.from('mentors').select('id, user_id, name, role').order('name'),
        supabase.from('requests').select('*').order('created_at', { ascending: false }),
        supabase.from('evaluations').select('*'),
      ]);
    } else {
      // Reduce data requested by the current UI. This does NOT replace RLS.
      const [mentors, requests, evaluations] = await Promise.all([
        supabase.from('mentors').select('id, user_id, name, role').eq('id', session.mentorId),
        supabase.from('requests').select('*').eq('claimed_by', session.mentorId).order('created_at', { ascending: false }),
        supabase.from('evaluations').select('*').eq('mentor_id', session.mentorId),
      ]);
      for (const result of [mentors, requests, evaluations]) if (result.error) throw result.error;
      const tables = [...new Set((requests.data ?? []).filter(request => request.status === 'claimed' && !request.cancelled_at).map(request => request.table_number))];
      const teams = tables.length
        ? await supabase.from('teams').select('id, name, table_number').in('table_number', tables).order('table_number')
        : { data: [], error: null };
      results = [teams, mentors, requests, evaluations];
    }
    if (!isCurrent()) return;
    for (const result of results) {
      if (result.error) throw result.error;
    }
    const [teams, mentors, requests, evaluations] = results.map(({ data }) => data ?? []);
    const mappedEvaluations = evaluations.map(mapEvaluation);
    setCache({
      teams: teams.map(mapTeam),
      mentors: mentors.map(mapMentor),
      requests: requests.map(mapRequest),
      evaluations: mappedEvaluations,
      submittedEvaluations: mappedEvaluations.filter(({ status }) => status === 'submitted'),
      loading: false,
      error: null,
    });
  } catch (error) {
    if (isCurrent()) setCache({ ...cache, loading: false, error: error.message || 'Could not load operations data.' });
  }
}

export function startRealtime(mentorId, role) {
  const session = { mentorId, role, revision: 0 };
  staffSession = session;
  setCache(emptyCache);
  const refresh = () => { void refreshData(session); };
  const channel = supabase.channel('zerohour-live-' + ++nextChannel);
  const tables = role === 'organizer' ? ['teams', 'mentors', 'evaluations'] : ['mentors', 'evaluations'];
  for (const table of tables) {
    const filter = role === 'organizer' ? {} : { filter: `${table === 'mentors' ? 'id' : 'mentor_id'}=eq.${mentorId}` };
    // Events only invalidate snapshots; no row payload (or access-code hash) is needed.
    channel.on('postgres_changes', { event: '*', schema: 'public', table, select: ['id'], ...filter }, refresh);
  }
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') refresh();
  });
  refresh();
  const reconcile = () => { if (document.visibilityState === 'visible') refresh(); };
  // Refresh legacy summary counts without subscribing to request payloads.
  const reconciliation = window.setInterval(reconcile, 30000);
  window.addEventListener('focus', reconcile);
  document.addEventListener('visibilitychange', reconcile);

  return () => {
    if (reconciliation !== null) window.clearInterval(reconciliation);
    window.removeEventListener('focus', reconcile);
    document.removeEventListener('visibilitychange', reconcile);
    if (staffSession === session) {
      staffSession = null;
      setCache(emptyCache);
    }
    void supabase.removeChannel(channel);
  };
}

export function refreshOperations() {
  return staffSession ? refreshData(staffSession) : Promise.resolve();
}

async function transitionRequest(session, rpc, args) {
  const { data, error } = await supabase.rpc(rpc, args);
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Could not update the request.');
  await refreshData(session);
}

export function claimRequest(requestId, assigneeId) {
  const session = requireStaff();
  if (session.role !== 'organizer') throw new Error('Only the Admin may allocate mentor requests.');
  requireOperationsWrites();
  return transitionRequest(session, 'claim_request', { p_request_id: requestId, p_mentor_id: assigneeId });
}

export function releaseRequest(requestId) {
  const session = requireStaff();
  if (session.role !== 'organizer') throw new Error('Only the Admin may release mentor requests.');
  requireOperationsWrites();
  return transitionRequest(session, 'release_request', { p_request_id: requestId });
}

export function resolveRequest(requestId) {
  requireOperationsWrites();
  return transitionRequest(requireStaff(), 'resolve_request', { p_request_id: requestId });
}

export async function getEvaluation(teamId) {
  const { mentorId } = requireStaff();
  if (!teamId) return null;

  const { data, error } = await supabase
    .from('evaluations')
    .select('*')
    .eq('team_id', teamId)
    .eq('mentor_id', mentorId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching evaluation:', error);
    throw error;
  }

  return data ? mapEvaluation(data) : null;
}

function validateRubricScores(scores) {
  if (!scores || typeof scores !== 'object') {
    throw new Error('Scores object is required.');
  }

  for (const criterion of DEFAULT_CRITERIA) {
    const val = scores[criterion.id];
    if (val === undefined || val === null || typeof val !== 'number' || Number.isNaN(val)) {
      throw new Error(`Missing or invalid score for "${criterion.label}".`);
    }
    if (val < 0 || val > MAX_SCORE) {
      throw new Error(`Score for "${criterion.label}" must be between 0 and ${MAX_SCORE}.`);
    }
  }
}

export async function submitEvaluation({ teamId, scores, comment = '', status = 'submitted' }) {
  requireOperationsWrites();
  if (!teamId) throw new Error('A team must be selected.');
  const session = requireStaff();
  const { mentorId } = session;

  validateRubricScores(scores);

  const nowIso = new Date().toISOString();
  const payload = {
    team_id: teamId,
    mentor_id: mentorId,
    scores,
    comment: comment.trim(),
    status,
    updated_at: nowIso,
  };

  if (status === 'submitted') {
    payload.submitted_at = nowIso;
  }

  const { data, error } = await supabase
    .from('evaluations')
    .upsert(payload, { onConflict: 'team_id,mentor_id' })
    .select()
    .single();

  if (error) {
    console.error('Error submitting evaluation:', error);
    throw error;
  }

  // Best-effort audit logging
  try {
    const { error: logError } = await supabase
      .from('activity_log')
      .insert({
        actor_id: mentorId,
        action: status === 'submitted' ? 'submit_evaluation' : 'save_draft_evaluation',
        entity_type: 'evaluation',
        entity_id: data?.id,
        details: { team_id: teamId, status },
      });

    if (logError) {
      console.warn('[ZeroHour] Non-fatal: failed to log evaluation activity:', logError);
    }
  } catch (logErr) {
    console.warn('[ZeroHour] Non-fatal: unexpected error logging evaluation activity:', logErr);
  }

  await refreshData(session);
  return mapEvaluation(data);
}
