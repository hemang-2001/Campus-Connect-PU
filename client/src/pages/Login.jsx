import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bus, AlertCircle } from 'lucide-react';

const ADMIN_EMAIL = 'hamang2001@gmail.com';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signIn, session, role, loading, profile } = useAuth();
  const navigate = useNavigate();

  // If already logged in on initial page visit, redirect to user's role dashboard
  useEffect(() => {
    // Only auto-redirect if user already has an active session (not while actively submitting)
    if (session && !loading && !isSubmitting && profile) {
      const userEmail = session?.user?.email?.toLowerCase();
      let currentRole = role || profile?.role || session?.user?.user_metadata?.role;
      if (userEmail === ADMIN_EMAIL.toLowerCase()) {
        currentRole = 'admin';
      }

      if (currentRole === 'driver') {
        navigate('/driver', { replace: true });
      } else if (currentRole === 'admin') {
        navigate('/admin', { replace: true });
      } else if (currentRole === 'student') {
        navigate('/', { replace: true });
      }
    }
  }, [session, role, loading, isSubmitting, profile, navigate]);

  // Direct password login for all users (students, drivers, admins)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email || !password) {
      setErrorMsg('Please enter both email and password');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await signIn(email.trim(), password);

      // Determine user role and redirect
      const userEmail = email.trim().toLowerCase();
      let userRole = data?.profile?.role || data?.user?.user_metadata?.role || 'student';

      if (userEmail === ADMIN_EMAIL.toLowerCase()) {
        userRole = 'admin';
      }

      if (userRole === 'driver') {
        navigate('/driver', { replace: true });
      } else if (userRole === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      console.error('Login error:', err);
      if (err.message?.includes('Invalid login credentials')) {
        setErrorMsg('Invalid email or password. Please try again.');
      } else if (err.message?.includes('Email rate limit exceeded')) {
        setErrorMsg('Supabase email rate limit reached. Please log in directly with your password.');
      } else {
        setErrorMsg(err.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center', padding: '24px 16px' }}>
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div
          className="brand-icon-wrap"
          style={{ width: '56px', height: '56px', margin: '0 auto 16px', borderRadius: '16px' }}
        >
          <Bus size={32} />
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Campus Connect</h1>
        <p className="text-sm text-muted mt-2">Sign in to track university shuttles in real time</p>
      </div>

      <div className="card">
        {/* Error Alert */}
        {errorMsg && (
          <div className="banner-alert banner-danger" role="alert" style={{ marginBottom: '16px' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Direct Password Login Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email-input">
              Campus Email
            </label>
            <input
              id="email-input"
              type="email"
              className="form-input"
              placeholder="student@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password-input">
              Password
            </label>
            <input
              id="password-input"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg mt-4"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Register Link */}
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <span className="text-sm text-muted">Don't have an account? </span>
          <Link to="/register" style={{ color: 'var(--blue)', fontWeight: 600, fontSize: '0.875rem' }}>
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}
