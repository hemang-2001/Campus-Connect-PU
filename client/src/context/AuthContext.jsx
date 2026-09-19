import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, API_BASE, isSupabaseConfigured } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch full profile details from the Express backend
  const fetchProfile = useCallback(async (token) => {
    if (!token) {
      setProfile(null);
      return null;
    }
    try {
      const res = await fetch(`${API_BASE}/api/profile/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error(`Profile fetch failed: ${res.status}`);
      }
      const data = await res.json();
      setProfile(data.profile);
      return data.profile;
    } catch (err) {
      console.warn('Failed to fetch profile from API, fallback to metadata:', err.message);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.access_token) {
      return await fetchProfile(session.access_token);
    }
  }, [session, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          if (initialSession?.access_token) {
            await fetchProfile(initialSession.access_token);
          }
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.access_token) {
        await fetchProfile(newSession.access_token);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (email, password) => {
    if (!isSupabaseConfigured) {
      throw new Error(
        'Supabase is not configured yet! Please create campus-connect/client/.env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the client.'
      );
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      return data;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async ({ email, password, fullName, role = 'student', registrationNo = '', phone = '' }) => {
    if (!isSupabaseConfigured) {
      throw new Error(
        'Supabase is not configured yet! Please create campus-connect/client/.env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the client.'
      );
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
            registration_no: registrationNo || null,
            phone: phone || null
          }
        }
      });
      if (error) throw error;
      return data;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const role = profile?.role || user?.user_metadata?.role || 'student';

  const value = {
    session,
    user,
    profile,
    role,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
