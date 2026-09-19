import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bus, Lock, Mail, AlertCircle } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email || !password) {
      setErrorMsg('Please enter both email and password');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await signIn(email, password);
      const userRole = data?.user?.user_metadata?.role || 'student';
      if (userRole === 'driver') {
        navigate('/driver');
      } else if (userRole === 'admin') {
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

  return (
    <div className="app-container" style={{ justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
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


        {errorMsg && (
          <div className="banner-alert banner-danger" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
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
