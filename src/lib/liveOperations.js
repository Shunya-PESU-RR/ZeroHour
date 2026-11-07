import { useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth';
import { supabase, teamSupabase } from './supabase';

export function useOperationsRpc() {
  const { accessRole } = useAuth();
  return accessRole === 'team' ? teamSupabase : supabase;
}

export async function operationsRpc(client, name, args) {
  const before = performance.now();
  const { data, error } = await client.rpc(name, args);
  if (error) {
    if (error.code === '23505') throw new Error('Your team already has an active mentor request.');
    if (error.code === 'PGRST202') throw new Error('Live operations are awaiting the reviewed database migrations.');
    throw new Error(error.code === 'P0001' ? error.message : 'The operation could not be completed. Please retry.');
  }
  return { data, sampledAt: (before + performance.now()) / 2 };
}

export function useOperationsRead(name, revision = 0, id = null, enabled = true) {
  const client = useOperationsRpc();
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let busy = false;
    async function read() {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const sample = await operationsRpc(client, name, id ? { p_id: id } : undefined);
        if (active) setResult({ ...sample, id, error: null });
      } catch (error) {
        if (active) setResult({ id, error: error.message });
      } finally {
        busy = false;
      }
    }
    void read();
    const timer = setInterval(read, 5000);
    document.addEventListener('visibilitychange', read);
    window.addEventListener('online', read);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', read);
      window.removeEventListener('online', read);
    };
  }, [client, name, revision, id, enabled]);
  return enabled && result?.id === id ? result : null;
}
