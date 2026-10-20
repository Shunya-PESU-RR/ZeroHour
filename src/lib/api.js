// MOCK DATA LAYER (saved in this browser's localStorage so a refresh keeps it).
// Every exported function is a swap point for Supabase. Keep names and return shapes.
import { useEffect, useState } from 'react';
import { REQUEST_STATUS } from '../types';
import { DEFAULT_CRITERIA } from '../config/rubric';

const KEY = 'zerohour-demo-v2';
const AUTH_KEY = 'zerohour-admin';

const seed = () => ({
  teams: [
    { id: 't1', name: 'Team Alpha', table: 1 },
    { id: 't2', name: 'Byte Me', table: 2 },
    { id: 't3', name: 'Null Pointers', table: 3 },
    { id: 't4', name: 'Stack Overflowers', table: 4 },
  ],
  mentors: [
    { id: 'm1', name: 'Asha' },
    { id: 'm2', name: 'Rahul' },
    { id: 'm3', name: 'Meera' },
  ],
  criteria: DEFAULT_CRITERIA,
  requests: [
    { id: 'r1', table: 2, issue: 'API returns 500 on login', status: 'open', claimedBy: null, createdAt: Date.now() - 120000 },
    { id: 'r2', table: 4, issue: 'Unsure how to deploy', status: 'claimed', claimedBy: 'm1', createdAt: Date.now() - 600000 },
  ],
  evaluations: [],
  registrations: [],
  accessRequests: [],
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...seed(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return seed();
}

let state = load();
const listeners = new Set();

function update(patch) {
  state = { ...state, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  listeners.forEach((fn) => fn());
}
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

// Live-updating read. Replace with a realtime subscription later.
export function useData(getter) {
  const [value, setValue] = useState(getter);
  useEffect(() => subscribe(() => setValue(getter())), []);
  return value;
}

export const selectTeams = () => state.teams;
export const selectMentors = () => state.mentors;
export const selectCriteria = () => state.criteria;
export const selectRequests = () => state.requests;
export const selectEvaluations = () => state.evaluations;
export const selectRegistrations = () => state.registrations;
export const selectAccessRequests = () => state.accessRequests;

export function getEvaluation(teamId, mentorId) {
  return state.evaluations.find((e) => e.teamId === teamId && e.mentorId === mentorId) || null;
}

// One evaluation per team per mentor (submitting again edits it)
export function submitEvaluation({ teamId, mentorId, scores, comment }) {
  const evaluation = { teamId, mentorId, scores, comment, updatedAt: Date.now() };
  const others = state.evaluations.filter((e) => !(e.teamId === teamId && e.mentorId === mentorId));
  update({ evaluations: [...others, evaluation] });
}

export function createRequest({ table, issue }) {
  const req = { id: 'r' + Date.now(), table, issue, status: REQUEST_STATUS.OPEN, claimedBy: null, createdAt: Date.now() };
  update({ requests: [req, ...state.requests] });
}

export function updateRequest(id, patch) {
  update({ requests: state.requests.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
}

// ---- Public: registration and mentor access ----
export function registerTeam({ teamName, college, email, members }) {
  const taken = state.registrations.some((r) => r.teamName.toLowerCase() === teamName.toLowerCase());
  if (taken) return { ok: false, error: 'A team with this name is already registered.' };
  const reg = { id: 'g' + Date.now(), teamName, college, email, members, createdAt: Date.now() };
  update({ registrations: [reg, ...state.registrations] });
  return { ok: true };
}

export function requestMentorAccess({ teamName, email, note }) {
  const req = { id: 'a' + Date.now(), teamName, email, note, status: 'pending', createdAt: Date.now() };
  update({ accessRequests: [req, ...state.accessRequests] });
  return { ok: true };
}

export function setAccessStatus(id, status) {
  update({ accessRequests: state.accessRequests.map((a) => (a.id === id ? { ...a, status } : a)) });
}

// ---- Admin uploads (replacing these clears evaluations, since old scores no longer fit) ----
export const replaceTeams = (teams) => update({ teams, evaluations: [] });
export const replaceMentors = (mentors) => update({ mentors, evaluations: [] });
export const replaceCriteria = (criteria) => update({ criteria, evaluations: [] });

// ---- Admin login (PLACEHOLDER: replace with Supabase auth) ----
export function adminLogin(username, password) {
  if (username === 'admin' && password === 'zerohour') {
    try { localStorage.setItem(AUTH_KEY, '1'); } catch { /* ignore */ }
    return true;
  }
  return false;
}
export const isAdmin = () => { try { return localStorage.getItem(AUTH_KEY) === '1'; } catch { return false; } };
export const adminLogout = () => { try { localStorage.removeItem(AUTH_KEY); } catch { /* ignore */ } };
