import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bus, AlertCircle } from 'lucide-react';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [registrationNo, setRegistrationNo] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      await signUp({
        email,
        password,
        fullName: fullName.trim(),
        role,
        registrationNo: registrationNo.trim().toUpperCase(),
        phone: phone.trim()
      });

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

      <div className="card">
        {errorMsg && (
          <div className="banner-alert banner-danger" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
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
              <option value="driver">Driver (Broadcast Phone GPS)</option>
              <option value="admin">Administrator (Fleet & Management)</option>
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
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <span className="text-sm text-muted">Already registered? </span>
          <Link to="/login" style={{ color: 'var(--blue)', fontWeight: 600, fontSize: '0.875rem' }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
