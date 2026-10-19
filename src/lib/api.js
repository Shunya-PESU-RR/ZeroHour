// MOCK DATA LAYER. Every function here is a swap point for Supabase/Firebase.
// Keep the function names and return shapes, replace the bodies.
import { useEffect, useState } from 'react';
import { REQUEST_STATUS } from '../types';

const state = {
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
  requests: [
    { id: 'r1', table: 2, issue: 'API returns 500 on login', status: 'open', claimedBy: null, createdAt: Date.now() - 120000 },
    { id: 'r2', table: 4, issue: 'Unsure how to deploy to Vercel', status: 'claimed', claimedBy: 'm1', createdAt: Date.now() - 600000 },
  ],
  evaluations: [],
};

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

// Live-updating read. Replace with a realtime subscription (onSnapshot / supabase.channel).
export function useData(getter) {
  const [value, setValue] = useState(getter);
  useEffect(() => subscribe(() => setValue(getter())), []);
  return value;
}

export const selectTeams = () => state.teams;
export const selectMentors = () => state.mentors;
export const selectRequests = () => state.requests;
export const selectEvaluations = () => state.evaluations;

export function getEvaluation(teamId, mentorId) {
  return state.evaluations.find((e) => e.teamId === teamId && e.mentorId === mentorId) || null;
}

// Create or edit (one evaluation per team per mentor)
export function submitEvaluation({ teamId, mentorId, scores, comment }) {
  const evaluation = { teamId, mentorId, scores, comment, updatedAt: Date.now() };
  const others = state.evaluations.filter((e) => !(e.teamId === teamId && e.mentorId === mentorId));
  state.evaluations = [...others, evaluation];
  emit();
}

// Dev A owns the team-facing request form; this exists so you can test the dashboard.
export function createRequest({ table, issue }) {
  const req = { id: 'r' + Date.now(), table, issue, status: REQUEST_STATUS.OPEN, claimedBy: null, createdAt: Date.now() };
  state.requests = [req, ...state.requests];
  emit();
}

export function updateRequest(id, patch) {
  state.requests = state.requests.map((r) => (r.id === id ? { ...r, ...patch } : r));
  emit();
}
