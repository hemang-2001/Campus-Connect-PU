import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import {
  Bus,
  Lock,
  Mail,
  AlertCircle,
  CheckCircle2,
  Shield,
  RefreshCw,
  Send,
  ArrowLeft
} from 'lucide-react';

const ADMIN_VERIFY_EMAIL = 'hamang2001@gmail.com';
const VERIFIED_DEVICE_KEY = 'campus_connect_admin_verified';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // One-time verification link & OTP state
  const [showVerification, setShowVerification] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [targetRole, setTargetRole] = useState('admin');

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signIn, session, role, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // If already authenticated (or returned from clicking the email magic link)
  useEffect(() => {
    if (session) {
      // Mark as verified on this device
      localStorage.setItem(VERIFIED_DEVICE_KEY, 'true');

      const urlRole = searchParams.get('role');
      const savedRole = localStorage.getItem('cc_target_role');
      const destRole = urlRole || savedRole || role;
      localStorage.removeItem('cc_target_role');

      if (destRole === 'driver') {
        navigate('/driver', { replace: true });
      } else if (destRole === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [session, role, navigate, searchParams]);

  // 60-second cooldown timer for resend
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Send one-time verification link to hamang2001@gmail.com
  const sendVerificationLink = async (intendedRole = 'admin') => {
    setTargetRole(intendedRole);
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      localStorage.setItem('cc_target_role', intendedRole);

      const redirectUrl = `${window.location.origin}/login?role=${intendedRole}`;
      const { error } = await supabase.auth.signInWithOtp({
        email: ADMIN_VERIFY_EMAIL,
        options: {
          emailRedirectTo: redirectUrl
        }
      });

      if (error) {
        if (error.status === 429 || error.message?.includes('security')) {
          throw new Error(
            'A verification email was recently requested. Please check your inbox or wait 60 seconds.'
          );
        }
        throw error;
      }

      setShowVerification(true);
      setSuccessMsg(
        `One-time verification link sent to ${ADMIN_VERIFY_EMAIL}! Check your inbox to sign in directly, or enter the 6-digit confirmation code below.`
      );
      setCooldown(60);
    } catch (err) {
      console.error('Error sending verification link:', err);
      setErrorMsg(err.message || 'Failed to send verification email. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Normal login submission (Email + Password)
  const handleNormalSubmit = async (e) => {
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

      // Students log in immediately as normal
      if (userRole === 'student') {
        navigate('/');
        return;
      }

      // For admin / driver: check if one-time verification was already done on this device
      const isAlreadyVerified = localStorage.getItem(VERIFIED_DEVICE_KEY) === 'true';

      if (isAlreadyVerified) {
        // Rest are same as normal login
        if (userRole === 'driver') {
          navigate('/driver');
        } else {
          navigate('/admin');
        }
      } else {
        // One-time verification link to hamang2001@gmail.com
        await sendVerificationLink(userRole);
      }
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg(err.message || 'Invalid email or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verify OTP code entered on the page
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

      // Mark this device as verified so all subsequent logins are normal
      localStorage.setItem(VERIFIED_DEVICE_KEY, 'true');

      await refreshProfile();

      const destination = targetRole === 'driver' ? '/driver' : '/admin';
      navigate(destination, { replace: true });
    } catch (err) {
      console.error('OTP verification error:', err);
      setErrorMsg(err.message || 'Invalid or expired verification code. Please check your email.');
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
          <div className="banner-alert banner-danger" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success Alert */}
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

        {/* 1. Normal Login Form (Campus Email + Password) */}
        {!showVerification ? (
          <div>
            <form onSubmit={handleNormalSubmit}>
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
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            {/* Divider for Admin/Driver One-Time Verification */}
            <div
              style={{
                margin: '22px 0 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--gray-200)' }} />
              <span
                style={{
                  fontSize: '0.6875rem',
                  color: 'var(--gray-400)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px'
                }}
              >
                Admin & Driver Verification
              </span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--gray-200)' }} />
            </div>

            {/* One-Time Verification Link Button */}
            <button
              type="button"
              className="btn btn-outline btn-full"
              onClick={() => sendVerificationLink('admin')}
              disabled={isSubmitting || cooldown > 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                padding: '11px 14px'
              }}
            >
              <Shield size={16} color="var(--blue)" />
              <span>
                {cooldown > 0
                  ? `Verification link sent (${cooldown}s)`
                  : `Send One-Time Verification Link to ${ADMIN_VERIFY_EMAIL}`}
              </span>
            </button>

            {/* Register Link */}
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <span className="text-sm text-muted">Don't have an account? </span>
              <Link to="/register" style={{ color: 'var(--blue)', fontWeight: 600, fontSize: '0.875rem' }}>
                Register here
              </Link>
            </div>
          </div>
        ) : (
          /* 2. One-Time Verification (OTP Code Entry) */
          <div>
            <div
              style={{
                backgroundColor: 'var(--blue-light)',
                border: '1px solid rgba(37, 99, 235, 0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                marginBottom: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <Shield size={16} color="var(--blue)" />
                <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--blue)' }}>
                  One-Time Identity Verification
                </span>
              </div>
              <p style={{ fontSize: '0.78125rem', color: 'var(--gray-600)', lineHeight: '1.4' }}>
                A verifying link and code have been sent to <strong>{ADMIN_VERIFY_EMAIL}</strong>. You can click the link in your email or enter the 6-digit confirmation code below. Once verified, future logins on this device will be normal.
              </p>
            </div>

            <form onSubmit={handleVerifyOtp}>
              <div className="form-group mb-3">
                <label className="form-label" htmlFor="otp-input" style={{ textAlign: 'center' }}>
                  Enter 6-Digit Confirmation Code
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
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full btn-lg mb-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Verifying...' : 'Verify Code & Sign In'}
              </button>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ flex: 1, fontSize: '0.8125rem', padding: '8px' }}
                  onClick={() => sendVerificationLink(targetRole)}
                  disabled={isSubmitting || cooldown > 0}
                >
                  <RefreshCw size={13} style={{ marginRight: '4px' }} />
                  {cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend Link'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: '0.8125rem', padding: '8px', color: 'var(--gray-600)' }}
                  onClick={() => {
                    setShowVerification(false);
                    setOtpCode('');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                >
                  <ArrowLeft size={13} style={{ marginRight: '4px' }} />
                  Back to Normal Login
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
