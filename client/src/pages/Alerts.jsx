import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../lib/supabaseClient';
import Badge from '../components/Badge';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import { Bell, AlertTriangle, Info, PlusCircle, CheckCircle, Clock } from 'lucide-react';

export default function Alerts() {
  const { session, role } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Form states for Admin
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState('info');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/alerts`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleCreateAlert = async (e) => {
    e.preventDefault();
    setFormError('');

    if (title.trim().length < 3) {
      setFormError('Title must be at least 3 characters');
      return;
    }
    if (body.trim().length < 5) {
      setFormError('Body must be at least 5 characters');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          severity
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to post alert');
      }

      setTitle('');
      setBody('');
      setShowCreate(false);
      fetchAlerts();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '16px 0' }}>
      <div className="flex-between mb-4">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Campus Alerts</h2>
          <p className="text-xs text-muted">Service delays, route updates & safety notices</p>
        </div>

        {role === 'admin' && (
          <button
            type="button"
            className="btn btn-primary"
            style={{ fontSize: '0.8125rem', padding: '6px 12px' }}
            onClick={() => setShowCreate(!showCreate)}
          >
            <PlusCircle size={16} />
            {showCreate ? 'Close' : 'Post Alert'}
          </button>
        )}
      </div>

      {/* Admin Quick Post Form */}
      {role === 'admin' && showCreate && (
        <div className="card mb-4" style={{ border: '2px solid var(--blue)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>
            Dispatch New Campus Alert
          </h3>

          {formError && (
            <div className="banner-alert banner-danger" role="alert">
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleCreateAlert}>
            <div className="form-group">
              <label className="form-label" htmlFor="alert-title">Title</label>
              <input
                id="alert-title"
                className="form-input"
                placeholder="e.g. Science Block Stop Relocation"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="alert-severity">Severity</label>
              <select
                id="alert-severity"
                className="form-select"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
              >
                <option value="info">Info (Blue)</option>
                <option value="warning">Warning (Amber)</option>
                <option value="critical">Critical (Red)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="alert-body">Description</label>
              <textarea
                id="alert-body"
                className="form-textarea"
                rows={3}
                placeholder="Provide notice details for students and faculty..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>

            <div className="flex-row" style={{ justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Publishing...' : 'Publish Alert'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Alerts Feed */}
      {loading ? (
        <Loader message="Fetching alerts..." />
      ) : alerts.length === 0 ? (
        <EmptyState
          title="No Active Alerts"
          message="All shuttles are running on normal campus schedule."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {alerts.map((alert) => {
            const isCrit = alert.severity === 'critical';
            const isWarn = alert.severity === 'warning';

            return (
              <div
                key={alert.id}
                className="card"
                style={{
                  borderLeft: `4px solid ${isCrit ? 'var(--rose)' : isWarn ? 'var(--amber)' : 'var(--blue)'}`
                }}
              >
                <div className="flex-between mb-2">
                  <div className="flex-row">
                    {isCrit ? (
                      <AlertTriangle size={18} color="var(--rose)" />
                    ) : isWarn ? (
                      <AlertTriangle size={18} color="var(--amber)" />
                    ) : (
                      <Info size={18} color="var(--blue)" />
                    )}
                    <h4 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>{alert.title}</h4>
                  </div>
                  <Badge variant={alert.severity}>{alert.severity}</Badge>
                </div>

                <p style={{ fontSize: '0.875rem', color: 'var(--gray-700)', lineHeight: 1.5 }}>
                  {alert.body}
                </p>

                <div
                  className="flex-between text-xs text-muted"
                  style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--gray-100)' }}
                >
                  <span className="flex-row">
                    <Clock size={12} />
                    <span>{new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                  {alert.route?.name && (
                    <span style={{ fontWeight: 600, color: 'var(--blue)' }}>
                      {alert.route.name}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
