import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, API_BASE, isSupabaseConfigured } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch full profile details from the Express backend with direct Supabase fallback
  const fetchProfile = useCallback(async (token, userObj = null) => {
    if (!token) {
      setProfile(null);
      return null;
    }

    let loadedProfile = null;

    // 1. Try Express API
    try {
      const res = await fetch(`${API_BASE}/api/profile/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          loadedProfile = data.profile;
        }
      }
    } catch (err) {
      console.warn('API profile fetch notice:', err.message);
    }

    // 2. Direct Supabase database fallback if Express didn't return
    if (!loadedProfile) {
      try {
        const activeUserId = userObj?.id || user?.id || (await supabase.auth.getUser()).data?.user?.id;
        if (activeUserId) {
          const { data: dbProf } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', activeUserId)
            .maybeSingle();

          if (dbProf) {
            loadedProfile = dbProf;
          }
        }
      } catch (fallbackErr) {
        console.warn('Direct Supabase profile fallback notice:', fallbackErr.message);
      }
    }

    if (loadedProfile) {
      setProfile(loadedProfile);
    }
    return loadedProfile;
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (session?.access_token) {
      return await fetchProfile(session.access_token, session.user);
    }
  }, [session, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        setLoading(true);
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          if (initialSession?.access_token) {
            await fetchProfile(initialSession.access_token, initialSession.user);
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
      if (newSession) {
        setSession(newSession);
        setUser(newSession.user);
        if (newSession.access_token) {
          await fetchProfile(newSession.access_token, newSession.user);
        }
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
      }
      if (mounted) setLoading(false);
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
        email: email.trim(),
        password
      });
      if (error) throw error;

      // 1. Fetch profile first to get verified database role
      let userProfile = null;
      if (data.session?.access_token) {
        userProfile = await fetchProfile(data.session.access_token, data.user);
      }

      // Check if user is approved (Staff/Driver must wait for admin approval)
      const userEmail = data.user?.email?.toLowerCase();
      const userRole = userProfile?.role || data.user?.user_metadata?.role || 'student';
      const isLeadAdmin = userEmail === 'hamang2001@gmail.com';
      const isApproved =
        isLeadAdmin ||
        data.user?.user_metadata?.is_approved === true ||
        userProfile?.is_approved === true ||
        data.user?.user_metadata?.is_approved !== false;

      if ((userRole === 'driver' || userRole === 'admin') && !isLeadAdmin && !isApproved) {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setProfile(null);
        throw new Error('Your driver/staff account is pending administrator approval. Please wait until approved by the Lead Administrator.');
      }

      setSession(data.session);
      setUser(data.user);
      setProfile(userProfile);

      return { ...data, profile: userProfile };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async ({ email, password, fullName, role = 'student', registrationNo = '', phone = '' }) => {
    setLoading(true);
    try {
      // 1. Register through backend with Supabase Admin API (pre-confirms email, zero rate limits)
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          fullName: fullName?.trim(),
          role,
          registrationNo: registrationNo?.trim(),
          phone: phone?.trim(),
          clientOrigin: window.location.origin
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Registration failed');
      }

      // If pending approval (driver/admin): return pending status (make them wait)
      if (data.pendingApproval) {
        return { pendingApproval: true, role, email: email.trim() };
      }

      // 2. For student or pre-approved admin: immediately sign in with password
      const { data: authData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (signInErr) {
        return { user: data.user, pendingApproval: false };
      }

      setSession(authData.session);
      setUser(authData.user);
      if (authData.session?.access_token) {
        await fetchProfile(authData.session.access_token);
      }

      return { ...authData, pendingApproval: false };
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

  const role = (user?.email?.toLowerCase() === 'hamang2001@gmail.com')
    ? 'admin'
    : (profile?.role || user?.user_metadata?.role || 'student');

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
