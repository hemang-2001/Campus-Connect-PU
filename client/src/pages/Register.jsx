import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bus, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [registrationNo, setRegistrationNo] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Waiting state for Driver / Staff pending admin approval
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [submittedRole, setSubmittedRole] = useState('');

  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!fullName.trim()) {
      setErrorMsg('Full name is required');
      return;
    }

    if (role === 'student' && registrationNo) {
      const regRegex = /^[A-Z]{2,4}\d{4,8}$/;
      if (!regRegex.test(registrationNo.trim().toUpperCase())) {
        setErrorMsg('Registration number must format as 2-4 uppercase letters + 4-8 digits (e.g. CS202401)');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const result = await signUp({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        role,
        registrationNo: registrationNo.trim().toUpperCase(),
        phone: phone.trim()
      });

      // If Driver/Admin: make them wait for administrator approval
      if (result?.pendingApproval) {
        setSubmittedEmail(email.trim());
        setSubmittedRole(role);
        setIsPendingApproval(true);
        return;
      }

      if (role === 'driver') {
        navigate('/driver');
      } else if (role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setErrorMsg(err.message || 'Registration failed. Please check your inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div
          className="brand-icon-wrap"
          style={{ width: '48px', height: '48px', margin: '0 auto 12px', borderRadius: '14px' }}
        >
          <Bus size={26} />
        </div>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 800 }}>Create an Account</h1>
        <p className="text-sm text-muted">Join the Campus Connect transport network</p>
      </div>

      {isPendingApproval ? (
        /* Waiting Screen for Driver / Staff */
        <div className="card" style={{ textAlign: 'center', padding: '36px 20px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#fef3c7',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              border: '2px solid #fde68a'
            }}
          >
            <Clock size={32} />
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px' }}>
            Registration Submitted
          </h2>

          <div
            style={{
              display: 'inline-block',
              backgroundColor: 'var(--blue-light)',
              color: 'var(--blue)',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              marginBottom: '16px',
              textTransform: 'uppercase'
            }}
          >
            {submittedRole} Account Pending
          </div>

          <p style={{ color: 'var(--gray-600)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '24px' }}>
            Your registration for <strong>{submittedEmail}</strong> has been received.
            <br /><br />
            An authorization request has been dispatched to the Lead Administrator (<strong>hamang2001@gmail.com</strong>).
            <br /><br />
            <strong>Please wait for approval.</strong> Once the administrator reviews and approves your account, you will be able to log in directly with your password.
          </p>

          <Link to="/login" className="btn btn-primary btn-full">
            Return to Sign In
          </Link>
        </div>
      ) : (
        <div className="card">
          {errorMsg && (
            <div className="banner-alert banner-danger" role="alert">
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span>{errorMsg}</span>
                {errorMsg.toLowerCase().includes('already exists') && (
                  <Link
                    to="/login"
                    style={{
                      color: 'var(--rose)',
                      fontWeight: 700,
                      textDecoration: 'underline',
                      fontSize: '0.8125rem'
                    }}
                  >
                    Click here to Log In directly &rarr;
                  </Link>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-name">
                Full Name
              </label>
              <input
                id="reg-name"
                type="text"
                className="form-input"
                placeholder="Alex Johnson"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-role">
                Account Role
              </label>
              <select
                id="reg-role"
                className="form-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="student">Student (Track & Complaints)</option>
                <option value="driver">Driver (Broadcast Phone GPS - Requires Approval)</option>
                <option value="admin">Administrator (Fleet Management - Requires Approval)</option>
              </select>
            </div>

            {role === 'student' && (
              <div className="form-group">
                <label className="form-label" htmlFor="reg-regno">
                  Student Registration No. (Optional)
                </label>
                <input
                  id="reg-regno"
                  type="text"
                  className="form-input"
                  placeholder="CS202401"
                  value={registrationNo}
                  onChange={(e) => setRegistrationNo(e.target.value.toUpperCase())}
                />
                <span className="form-hint">e.g. CS202401, EN102938</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="reg-phone">
                Mobile Phone (Optional)
              </label>
              <input
                id="reg-phone"
                type="tel"
                className="form-input"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">
                Email Address
              </label>
              <input
                id="reg-email"
                type="email"
                className="form-input"
                placeholder="alex@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">
                Password
              </label>
              <input
                id="reg-password"
                type="password"
                className="form-input"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg mt-4"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting registration...' : 'Create Account'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <span className="text-sm text-muted">Already registered? </span>
            <Link to="/login" style={{ color: 'var(--blue)', fontWeight: 600, fontSize: '0.875rem' }}>
              Sign in
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
