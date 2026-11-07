import { useEffect, useState, useSyncExternalStore } from 'react';
import { supabase, teamSupabase, isSupabaseConfigured } from '../lib/supabase';
import { AuthContext } from './useAuth';
import { createSessionController } from './sessionController';

export function AuthProvider({ children }) {
  const [controller] = useState(() => createSessionController({ staff: supabase, teamClient: teamSupabase, configured: isSupabaseConfigured }));
  const session = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => controller.start(), [controller]);

  const value = {
    ...session,
    accessRole: session.role,
    // Preserve the existing staff role names consumed by live API selectors.
    role: session.mentor?.role ?? (session.role === 'team' ? 'team' : null),
    mentorId: session.mentor?.id ?? null,
    isOrganizer: session.role === 'admin',
    isMentor: ['admin', 'mentor'].includes(session.role),
    loading: ['loading', 'logging_out'].includes(session.status),
    profileError: session.error,
    authError: session.error,
    refreshSession: controller.refresh,
    refreshMentor: controller.refresh,
    signIn: controller.signIn,
    signInTeam: controller.signInTeam,
    signOut: controller.signOut,
    signUp: async (email, password, name) => {
      const result = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() } } });
      if (result.error) throw new Error('Account creation could not be completed. Please contact an organizer.');
      return result.data;
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
