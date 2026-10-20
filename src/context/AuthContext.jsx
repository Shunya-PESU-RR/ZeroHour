import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuthContext } from './useAuth';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [mentor, setMentor] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [authError, setAuthError] = useState(null);
  const [profileError, setProfileError] = useState(null);

  const fetchMentorProfile = useCallback(async (userId) => {
    if (!userId || !isSupabaseConfigured) {
      setMentor(null);
      setProfileError(null);
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('mentors')
        .select('id, user_id, name, role')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching mentor profile:', error);
        setMentor(null);
        setProfileError(error.message || 'Failed to fetch mentor profile');
        return null;
      }

      setProfileError(null);
      setMentor(data || null);
      return data || null;
    } catch (err) {
      console.error('Unexpected error fetching mentor:', err);
      setMentor(null);
      setProfileError(err.message || 'Unexpected error fetching mentor profile');
      return null;
    }
  }, []);

  
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function syncSession(session) {
      if (!mounted) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await fetchMentorProfile(currentUser.id);
      } else {
        setMentor(null);
        setProfileError(null);
      }

      if (mounted) setLoading(false);
    }

    // Register the listener first so auth changes aren't missed.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer profile queries until after the auth callback finishes.
      Promise.resolve().then(() => syncSession(session));
    });

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) console.error('Failed to get session:', error);
      if (mounted) {
        Promise.resolve().then(() => syncSession(session));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchMentorProfile]);


  const signIn = async (email, password) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setAuthError(error.message);
      throw error;
    }
    if (data.user) {
      await fetchMentorProfile(data.user.id);
    }
    return data;
  };


  const signUp = async (email, password, name) => {
    setAuthError(null);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: name.trim(),
        },
      },
    });

    if (error) {
      setAuthError(error.message);
      throw error;
    }

    return data;
  };

  const signOut = async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signOut();
    setUser(null);
    setMentor(null);
    if (error) throw error;
  };

  const value = {
    user,
    mentor,
    mentorId: mentor?.id ?? null,
    role: mentor?.role ?? null,
    isOrganizer: mentor?.role === 'organizer',
    isMentor: Boolean(mentor),
    loading,
    authError,
    setAuthError,
    profileError,
    setProfileError,
    signIn,
    signUp,
    signOut,
    refreshMentor: () => (user ? fetchMentorProfile(user.id) : Promise.resolve(null)),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
