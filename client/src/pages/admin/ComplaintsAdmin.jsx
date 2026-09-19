import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../lib/supabaseClient';
import Badge from '../../components/Badge';
import Loader from '../../components/Loader';
import EmptyState from '../../components/EmptyState';
import { MessageSquare, User, Phone, CheckCircle, Save, Filter, RefreshCw } from 'lucide-react';

export default function ComplaintsAdmin() {
  const { session } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [statusDrafts, setStatusDrafts] = useState({});
  const [noteDrafts, setNoteDrafts] = useState({});
  const [successMsg, setSuccessMsg] = useState('');

  const fetchAllComplaints = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/complaints`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch complaints');
      const data = await res.json();
      const list = data.complaints || [];
      setComplaints(list);

      // Initialize edit drafts
      const sMap = {};
      const nMap = {};
      list.forEach((c) => {
        sMap[c.id] = c.status;
        nMap[c.id] = c.admin_note || '';
      });
      setStatusDrafts(sMap);
      setNoteDrafts(nMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.access_token) {
      fetchAllComplaints();
    }
  }, [session]);

  const handleSaveComplaint = async (id) => {
    setSavingId(id);
    setSuccessMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/complaints/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          status: statusDrafts[id],
          admin_note: noteDrafts[id]
        })
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to update complaint');
      }

      setSuccessMsg('Complaint updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchAllComplaints();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const filtered = complaints.filter((c) => {
    if (filterStatus === 'all') return true;
    return c.status === filterStatus;
  });

  return (
    <div style={{ padding: '16px 0' }}>
      <div className="flex-between mb-3">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Student Complaints</h2>
          <p className="text-xs text-muted">Review, escalate, and resolve student grievances</p>
        </div>

        <button
          type="button"
          className="btn btn-outline"
          style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
          onClick={fetchAllComplaints}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {successMsg && (
        <div className="banner-alert banner-success mb-3" role="status">
          <CheckCircle size={18} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '12px',
          marginBottom: '12px',
          scrollbarWidth: 'none'
        }}
      >
        {['all', 'open', 'in_progress', 'resolved', 'rejected'].map((st) => (
          <button
            key={st}
            type="button"
            className={`btn ${filterStatus === st ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: 'var(--radius-full)' }}
            onClick={() => setFilterStatus(st)}
          >
            {st.replace('_', ' ').toUpperCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <Loader message="Loading complaints queue..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Complaints in this category"
          message="There are no student grievances matching this status filter."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filtered.map((c) => (
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
              <p style={{ fontSize: '0.875rem', color: 'var(--gray-700)', lineHeight: 1.5, marginBottom: '12px' }}>
                {c.body}
              </p>

              {/* Student Metadata Box */}
              <div
                style={{
                  background: 'var(--gray-50)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                  marginBottom: '12px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  color: 'var(--gray-700)'
                }}
              >
                <span className="flex-row">
                  <User size={14} color="var(--gray-500)" />
                  <span>{c.student?.full_name || 'Anonymous Student'}</span>
                </span>
                {c.student?.registration_no && (
                  <span style={{ fontWeight: 600 }}>
                    Reg: {c.student.registration_no}
                  </span>
                )}
                {c.student?.phone && (
                  <span className="flex-row">
                    <Phone size={14} color="var(--gray-500)" />
                    <span>{c.student.phone}</span>
                  </span>
                )}
              </div>

              {/* Admin Action Controls */}
              <div
                style={{
                  borderTop: '1px solid var(--gray-200)',
                  paddingTop: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div className="flex-between" style={{ gap: '10px' }}>
                  <label htmlFor={`status-${c.id}`} className="text-xs font-semibold text-muted">
                    Resolution Status:
                  </label>
                  <select
                    id={`status-${c.id}`}
                    className="form-select"
                    style={{ padding: '6px 10px', fontSize: '0.8125rem', width: 'auto' }}
                    value={statusDrafts[c.id] || c.status}
                    onChange={(e) =>
                      setStatusDrafts({ ...statusDrafts, [c.id]: e.target.value })
                    }
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor={`note-${c.id}`} className="text-xs font-semibold text-muted">
                    Official Admin Note to Student:
                  </label>
                  <textarea
                    id={`note-${c.id}`}
                    className="form-textarea"
                    rows={2}
                    placeholder="Enter resolution notes, corrective action, or explanation..."
                    value={noteDrafts[c.id] ?? ''}
                    onChange={(e) =>
                      setNoteDrafts({ ...noteDrafts, [c.id]: e.target.value })
                    }
                    style={{ fontSize: '0.8125rem' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: '0.8125rem', padding: '6px 14px' }}
                    onClick={() => handleSaveComplaint(c.id)}
                    disabled={savingId === c.id}
                  >
                    <Save size={14} />
                    <span>{savingId === c.id ? 'Saving...' : 'Update Ticket'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
