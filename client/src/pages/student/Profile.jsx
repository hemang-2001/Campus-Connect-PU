import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../lib/supabaseClient';
import { User, Phone, BookOpen, Mail, Shield, CheckCircle, AlertCircle, Save } from 'lucide-react';

export default function Profile() {
  const { session, profile, role, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [registrationNo, setRegistrationNo] = useState('');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
      setRegistrationNo(profile.registration_no || '');
    }
  }, [profile]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      // 1. Update basic info (name, phone)
      const resProfile = await fetch(`${API_BASE}/api/profile/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim()
        })
      });

      if (!resProfile.ok) {
        const d = await resProfile.json();
        throw new Error(d.error || 'Failed to update personal profile');
      }

      // 2. If student and registration number changed, update registration
      if (role === 'student' && registrationNo && registrationNo !== profile?.registration_no) {
        const resReg = await fetch(`${API_BASE}/api/profile/registration`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            registrationNo: registrationNo.trim().toUpperCase()
          })
        });

        if (!resReg.ok) {
          const d = await resReg.json();
          throw new Error(d.error || 'Failed to update registration number');
        }
      }

      await refreshProfile();
      setSuccessMsg('Profile updated successfully!');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '16px 0' }}>
      <div className="flex-between mb-4">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>My Profile</h2>
          <p className="text-xs text-muted">Manage your identity and transport contact info</p>
        </div>

        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            background: role === 'admin' ? '#fee2e2' : role === 'driver' ? '#fef3c7' : '#dbeafe',
            color: role === 'admin' ? '#991b1b' : role === 'driver' ? '#92400e' : '#1e40af'
          }}
        >
          {role}
        </span>
      </div>

      <div className="card">
        {successMsg && (
          <div className="banner-alert banner-success" role="status">
            <CheckCircle size={18} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="banner-alert banner-danger" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleUpdate}>
          <div className="form-group">
            <label className="form-label" htmlFor="profile-email">
              Campus Email (Read-Only)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="profile-email"
                type="email"
                className="form-input"
                value={session?.user?.email || ''}
                disabled
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="profile-name">
              Full Name
            </label>
            <input
              id="profile-name"
              type="text"
              className="form-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          {role === 'student' && (
            <div className="form-group">
              <label className="form-label" htmlFor="profile-regno">
                Registration Number
              </label>
              <input
                id="profile-regno"
                type="text"
                className="form-input"
                value={registrationNo}
                placeholder="e.g. CS202401"
                onChange={(e) => setRegistrationNo(e.target.value.toUpperCase())}
              />
              <span className="form-hint">Pattern: 2-4 uppercase letters + 4-8 digits</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="profile-phone">
              Phone Number
            </label>
            <input
              id="profile-phone"
              type="tel"
              className="form-input"
              value={phone}
              placeholder="+91 98765 43210"
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg mt-4"
            disabled={saving}
          >
            <Save size={18} />
            <span>{saving ? 'Saving changes...' : 'Save Profile'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
