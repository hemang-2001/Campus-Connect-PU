import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAlertNotifications } from '../context/AlertNotificationContext';
import { API_BASE } from '../lib/supabaseClient';
import Badge from '../components/Badge';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  PlusCircle,
  Clock,
  CheckCheck
} from 'lucide-react';

export default function Alerts() {
  const { session, role } = useAuth();
  const {
    alerts,
    unreadCount,
    markAsRead,
    markAllAsRead,
    fetchAlerts
  } = useAlertNotifications();


  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Form states for Admin
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState('info');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      {/* Header */}
      <div className="flex-between mb-3">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Campus Alerts</h2>
            {unreadCount > 0 && (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  backgroundColor: 'var(--rose-light)',
                  color: 'var(--rose)',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  border: '1px solid rgba(239, 68, 68, 0.3)'
                }}
              >
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-xs text-muted">Service delays, route updates & safety notices</p>
        </div>

        <div className="flex-row">
          {unreadCount > 0 && (
            <button
              type="button"
              className="btn btn-outline"
              style={{ fontSize: '0.75rem', padding: '6px 10px' }}
              onClick={markAllAsRead}
              title="Mark all as read"
            >
              <CheckCheck size={14} />
              <span>Read All</span>
            </button>
          )}

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
                className="card card-interactive"
                onClick={() => markAsRead(alert.id)}
                style={{
                  borderLeft: `4px solid ${isCrit ? 'var(--rose)' : isWarn ? 'var(--amber)' : 'var(--blue)'}`,
                  cursor: 'pointer'
                }}
              >
                <div className="flex-between mb-2">
                  <div className="flex-row">
                    {isCrit ? (
                      <AlertCircle size={18} color="var(--rose)" />
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
                      📍 {alert.route.name}
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
