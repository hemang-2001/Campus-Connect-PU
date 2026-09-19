import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, API_BASE } from '../../lib/supabaseClient';
import Badge from '../../components/Badge';
import Loader from '../../components/Loader';
import EmptyState from '../../components/EmptyState';
import { PlusCircle, MessageSquare, Clock, CheckCircle2, RefreshCw } from 'lucide-react';

export default function Complaints() {
  const { session } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchComplaints = async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError('');
      const res = await fetch(`${API_BASE}/api/complaints`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });
      if (!res.ok) throw new Error('Failed to load your complaints');
      const data = await res.json();
      setComplaints(data.complaints || []);
    } catch (err) {
      console.error(err);
      if (!isBackground) {
        setError(err.message);
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    if (!session?.access_token) return;

    fetchComplaints(false);

    // Auto-refresh interval (every 5 seconds)
    const interval = setInterval(() => {
      fetchComplaints(true);
    }, 5000);

    // Supabase Realtime subscription on complaints table
    const channel = supabase
      .channel('student-complaints-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'complaints' },
        () => {
          fetchComplaints(true);
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [session]);

  return (
    <div style={{ padding: '16px 0' }}>
      <div className="flex-between mb-4">
        <div>
          <div className="flex-row" style={{ gap: '8px', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>My Complaints</h2>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.6875rem',
                fontWeight: 600,
                color: '#16a34a',
                background: '#f0fdf4',
                padding: '2px 8px',
                borderRadius: '12px',
                border: '1px solid #bbf7d0'
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
              Live
            </span>
          </div>
          <p className="text-xs text-muted">Track grievances submitted to university transport (auto-refreshes live)</p>
        </div>

        <div className="flex-row" style={{ gap: '8px' }}>
          <button
            type="button"
            className="btn btn-outline"
            style={{ fontSize: '0.8125rem', padding: '6px 10px' }}
            onClick={() => fetchComplaints(true)}
            title="Refresh complaints"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
          </button>
          <Link to="/complaints/new" className="btn btn-primary" style={{ fontSize: '0.8125rem', padding: '6px 12px' }}>
            <PlusCircle size={16} />
            <span>New</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <Loader message="Loading complaints..." />
      ) : error ? (
        <div className="banner-alert banner-danger" role="alert">{error}</div>
      ) : complaints.length === 0 ? (
        <EmptyState
          title="No Complaints Submitted"
          message="Have an issue with campus shuttles, routes, or drivers? Let the admin know."
          action={
            <Link to="/complaints/new" className="btn btn-primary">
              File a Complaint
            </Link>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {complaints.map((c) => (
            <div key={c.id} className="card">
              <div className="flex-between mb-2">
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--blue)',
                    background: 'var(--blue-light)',
                    padding: '2px 8px',
                    borderRadius: '4px'
                  }}
                >
                  {c.category}
                </span>
                <Badge variant={c.status}>{c.status.replace('_', ' ')}</Badge>
              </div>

              <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '6px' }}>
                {c.subject}
              </h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--gray-700)', lineHeight: 1.5 }}>
                {c.body}
              </p>

              {/* Admin Note if addressed */}
              {c.admin_note && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '8px 12px',
                    background: 'var(--gray-50)',
                    borderLeft: '3px solid var(--blue)',
                    borderRadius: '4px',
                    fontSize: '0.8125rem'
                  }}
                >
                  <strong style={{ color: 'var(--gray-800)', display: 'block', marginBottom: '2px' }}>
                    Transport Admin Response:
                  </strong>
                  <span style={{ color: 'var(--gray-600)' }}>{c.admin_note}</span>
                </div>
              )}

              <div
                className="flex-between text-xs text-muted"
                style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--gray-100)' }}
              >
                <span className="flex-row">
                  <Clock size={12} />
                  <span>{new Date(c.created_at).toLocaleDateString()} at {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
