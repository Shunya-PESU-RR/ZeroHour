import { DEFAULT_CRITERIA } from '../config/rubric';

// Legacy setup records are isolated from live staff data and evaluations.
const KEY = 'zerohour-demo-v2';
const defaults = { teams: [], mentors: [], criteria: DEFAULT_CRITERIA, registrations: [], accessRequests: [] };

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY)) ?? {};
    return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [
      key, Array.isArray(saved[key]) ? saved[key] : fallback,
    ]));
  } catch {
    return defaults;
  }
}

let state = load();

function update(patch) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { /* invalid legacy data */ }
  localStorage.setItem(KEY, JSON.stringify({ ...saved, ...patch }));
  state = { ...state, ...patch };
  return state;
}

export function getLocalSetup() { return state; }
export function replaceLocalList(key, items) { return update({ [key]: items }); }
export function setLocalAccessStatus(id, status) {
  return update({ accessRequests: state.accessRequests.map((request) =>
    request.id === id ? { ...request, status } : request) });
}
