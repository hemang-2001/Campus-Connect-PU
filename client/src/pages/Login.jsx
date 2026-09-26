import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import {
  Bus,
  Shield,
  GraduationCap,
  Mail,
  Lock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Send,
  KeyRound
} from 'lucide-react';

const ADMIN_VERIFY_EMAIL = 'hamang2001@gmail.com';

export default function Login() {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role');
  const [activeTab, setActiveTab] = useState(
    initialRole === 'driver' || initialRole === 'admin' ? initialRole : 'student'
  );

  // Student & Password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Admin & Driver Verification link / OTP state
  const [otpCode, setOtpCode] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showPasswordFallback, setShowPasswordFallback] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signIn, session, role, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // If already authenticated or authenticated via email magic link redirect
  useEffect(() => {
    if (session) {
      const urlRole = searchParams.get('role');
      const savedRole = localStorage.getItem('cc_target_role');
      const targetRole = urlRole || savedRole || role;
      localStorage.removeItem('cc_target_role');

      if (targetRole === 'driver') {
        navigate('/driver', { replace: true });
      } else if (targetRole === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [session, role, navigate, searchParams]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Tab change handler
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setErrorMsg('');
    setSuccessMsg('');
    setShowPasswordFallback(false);
  };

  // 1. Student / Password Form Submit
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email || !password) {
      setErrorMsg('Please enter both email and password');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await signIn(email, password);
      const userRole = data?.user?.user_metadata?.role || 'student';
      if (userRole === 'driver' || activeTab === 'driver') {
        navigate('/driver');
      } else if (userRole === 'admin' || activeTab === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg(err.message || 'Invalid email or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Admin / Driver: Send Verification Link to hamang2001@gmail.com
  const handleSendVerificationLink = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      localStorage.setItem('cc_target_role', activeTab);

      const redirectUrl = `${window.location.origin}/login?role=${activeTab}`;
      const { error } = await supabase.auth.signInWithOtp({
        email: ADMIN_VERIFY_EMAIL,
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (error) {
        if (error.status === 429 || error.message?.includes('security')) {
          throw new Error(
            'A verification email was recently requested. Please check your inbox (including spam) or wait 60 seconds.'
          );
        }
        throw error;
      }

      setVerificationSent(true);
      setSuccessMsg(
        `Verifying link sent to ${ADMIN_VERIFY_EMAIL}! Click the link in your email to sign in directly, or enter the 6-digit confirmation code below.`
      );
      setCooldown(60);
    } catch (err) {
      console.error('Error sending verification email:', err);
      setErrorMsg(err.message || 'Failed to send verification email. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Admin / Driver: Verify 6-digit OTP code
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      setErrorMsg('Please enter the 6-digit code received in your email.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: ADMIN_VERIFY_EMAIL,
        token: otpCode.trim(),
        type: 'email'
      });

      if (error) throw error;

      await refreshProfile();

      if (activeTab === 'driver') {
        navigate('/driver', { replace: true });
      } else if (activeTab === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      console.error('OTP verification error:', err);
      setErrorMsg(err.message || 'Invalid or expired verification code. Please check your email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div
          className="brand-icon-wrap"
          style={{ width: '56px', height: '56px', margin: '0 auto 16px', borderRadius: '16px' }}
        >
          <Bus size={32} />
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Campus Connect</h1>
        <p className="text-sm text-muted mt-2">
          {activeTab === 'student' && 'Sign in to track university shuttles in real time'}
          {activeTab === 'driver' && 'Driver Portal: Authenticate to broadcast live vehicle GPS'}
          {activeTab === 'admin' && 'Admin Portal: System administration & fleet management'}
        </p>
      </div>

      <div className="card">
        {/* Role Switcher Tabs */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--gray-100)',
            borderRadius: 'var(--radius-lg)',
            padding: '4px',
            marginBottom: '20px',
            gap: '4px'
          }}
        >
          <button
            type="button"
            onClick={() => handleTabChange('student')}
            style={{
              flex: 1,
              padding: '8px 8px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              backgroundColor: activeTab === 'student' ? '#ffffff' : 'transparent',
              color: activeTab === 'student' ? 'var(--blue)' : 'var(--gray-600)',
              boxShadow: activeTab === 'student' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <GraduationCap size={15} />
            <span>Student</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('driver')}
            style={{
              flex: 1,
              padding: '8px 8px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              backgroundColor: activeTab === 'driver' ? '#ffffff' : 'transparent',
              color: activeTab === 'driver' ? 'var(--blue)' : 'var(--gray-600)',
              boxShadow: activeTab === 'driver' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <Bus size={15} />
            <span>Driver</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('admin')}
            style={{
              flex: 1,
              padding: '8px 8px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              backgroundColor: activeTab === 'admin' ? '#ffffff' : 'transparent',
              color: activeTab === 'admin' ? 'var(--blue)' : 'var(--gray-600)',
              boxShadow: activeTab === 'admin' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <Shield size={15} />
            <span>Admin</span>
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="banner-alert banner-danger" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div
            className="banner-alert"
            style={{
              backgroundColor: 'var(--emerald-light)',
              color: '#065f46',
              border: '1px solid #a7f3d0'
            }}
            role="status"
          >
            <CheckCircle2 size={18} style={{ flexShrink: 0, color: 'var(--emerald)' }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TAB 1: STUDENT LOGIN (Standard Email & Password - untouched) */}
        {activeTab === 'student' && (
          <form onSubmit={handlePasswordSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email-input">
                Campus Email
              </label>
              <div style={{ position: 'relative' }}>
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
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password-input">
                Password
              </label>
              <div style={{ position: 'relative' }}>
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
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg mt-4"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in...' : 'Sign In as Student'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <span className="text-sm text-muted">Don't have an account? </span>
              <Link to="/register" style={{ color: 'var(--blue)', fontWeight: 600, fontSize: '0.875rem' }}>
                Register here
              </Link>
            </div>
          </form>
        )}

        {/* TAB 2 & 3: DRIVER & ADMIN LOGIN (Sends verifying link to hamang2001@gmail.com) */}
        {(activeTab === 'driver' || activeTab === 'admin') && (
          <div>
            {!showPasswordFallback ? (
              <div>
                {/* Security verification notice card */}
                <div
                  style={{
                    backgroundColor: 'var(--blue-light)',
                    border: '1px solid rgba(37, 99, 235, 0.2)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px',
                    marginBottom: '18px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <Shield size={18} color="var(--blue)" />
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--blue)' }}>
                      Authorized Verification Required
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--gray-700)', lineHeight: '1.45' }}>
                    For campus security, access to the <strong>{activeTab === 'driver' ? 'Driver Terminal' : 'Admin Console'}</strong> requires a secure verifying link sent to the lead administrator.
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--border-subtle)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      marginTop: '10px'
                    }}
                  >
                    <Mail size={16} color="var(--blue)" />
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--gray-800)' }}>
                      {ADMIN_VERIFY_EMAIL}
                    </span>
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        backgroundColor: '#dbeafe',
                        color: '#1e40af',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}
                    >
                      VERIFIED
                    </span>
                  </div>
                </div>

                {!verificationSent ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-full btn-lg"
                    onClick={handleSendVerificationLink}
                    disabled={isSubmitting || cooldown > 0}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <Send size={18} />
                    <span>
                      {isSubmitting
                        ? 'Sending verifying link...'
                        : `Send Verifying Link to ${ADMIN_VERIFY_EMAIL}`}
                    </span>
                  </button>
                ) : (
                  <div>
                    {/* OTP Entry Form */}
                    <form onSubmit={handleVerifyOtp}>
                      <div className="form-group mb-3">
                        <label className="form-label" htmlFor="otp-input">
                          Enter 6-Digit Verification Code
                        </label>
                        <input
                          id="otp-input"
                          type="text"
                          inputMode="numeric"
                          className="form-input"
                          placeholder="e.g. 123456"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          maxLength={8}
                          autoFocus
                          style={{
                            fontSize: '1.25rem',
                            letterSpacing: '4px',
                            textAlign: 'center',
                            fontWeight: 700
                          }}
                        />
                        <span className="form-hint" style={{ textAlign: 'center', display: 'block', marginTop: '4px' }}>
                          Check the email sent to {ADMIN_VERIFY_EMAIL}
                        </span>
                      </div>

                      <button
                        type="submit"
                        className="btn btn-primary btn-full btn-lg mb-2"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Verifying...' : `Verify & Enter ${activeTab === 'driver' ? 'Driver Portal' : 'Admin Console'}`}
                      </button>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ flex: 1, fontSize: '0.8125rem', padding: '8px' }}
                          onClick={handleSendVerificationLink}
                          disabled={isSubmitting || cooldown > 0}
                        >
                          <RefreshCw size={13} style={{ marginRight: '4px' }} />
                          {cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend Link'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ fontSize: '0.8125rem', padding: '8px' }}
                          onClick={() => { setVerificationSent(false); setOtpCode(''); }}
                        >
                          Reset
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Password Fallback Toggle */}
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                  <button
                    type="button"
                    onClick={() => setShowPasswordFallback(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--gray-500)',
                      fontSize: '0.8125rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      textDecoration: 'underline'
                    }}
                  >
                    <KeyRound size={13} />
                    <span>Or sign in with password</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Password Fallback Form for Admin/Driver */
              <div>
                <form onSubmit={handlePasswordSubmit}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="staff-email">
                      {activeTab === 'driver' ? 'Driver' : 'Admin'} Email
                    </label>
                    <input
                      id="staff-email"
                      type="email"
                      className="form-input"
                      placeholder={activeTab === 'driver' ? 'driver@campus.edu' : 'admin@campus.edu'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="staff-password">
                      Password
                    </label>
                    <input
                      id="staff-password"
                      type="password"
                      className="form-input"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-full btn-lg mt-3"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Signing in...' : `Sign In as ${activeTab === 'driver' ? 'Driver' : 'Admin'}`}
                  </button>

                  <div style={{ textAlign: 'center', marginTop: '16px' }}>
                    <button
                      type="button"
                      onClick={() => setShowPasswordFallback(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--blue)',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      ← Back to Email Verifying Link
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
