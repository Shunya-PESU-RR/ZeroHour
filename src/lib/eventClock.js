export function clockReading(sample, monotonicNow) {
  if (!sample.data.starts_at) return { label: 'Event Not Started', display: '—:—:—', phase: 'unscheduled' };
  const start = Date.parse(sample.data.starts_at);
  const end = Date.parse(sample.data.ends_at);
  const now = Date.parse(sample.data.server_now) + monotonicNow - sample.sampledAt;
  const phase = now < start ? 'before' : now < end ? 'live' : 'ended';
  const seconds = Math.max(0, Math.ceil(((phase === 'before' ? start : end) - now) / 1000));
  return {
    phase,
    label: phase === 'before' ? 'Event Not Started' : phase === 'live' ? 'Hackathon Live' : 'Hackathon Ended',
    display: [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':'),
  };
}

export const istTimestamp = value => value ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'medium' }) + ' IST' : 'Unscheduled';
