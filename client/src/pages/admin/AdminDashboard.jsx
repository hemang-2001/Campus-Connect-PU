import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../lib/supabaseClient';
import Badge from '../../components/Badge';
import Loader from '../../components/Loader';
import {
  Bus,
  Activity,
  AlertTriangle,
  MessageSquare,
  Users,
  ExternalLink,
  RefreshCw,
  Clock,
  Trash2,
  Mail,
  ShieldCheck,
  Check
} from 'lucide-react';

export default function AdminDashboard() {
  const { session } = useAuth();
  const [buses, setBuses] = useState([]);
  const [complaintsCount, setComplaintsCount] = useState(0);
  const [alertsCount, setAlertsCount] = useState(0);
  const [users, setUsers] = useState([]);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [approvingUserId, setApprovingUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);

      // 1. Fetch fleet
      const busRes = await fetch(`${API_BASE}/api/tracking/active`);
      if (busRes.ok) {
        const d = await busRes.json();
        setBuses(d.buses || []);
      }

      // 2. Fetch complaints count
      if (session?.access_token) {
        const compRes = await fetch(`${API_BASE}/api/complaints`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (compRes.ok) {
          const compData = await compRes.json();
          const open = (compData.complaints || []).filter((c) => c.status === 'open');
          setComplaintsCount(open.length);
        }
      }

      // 3. Fetch alerts count
      const alertRes = await fetch(`${API_BASE}/api/alerts`);
      if (alertRes.ok) {
        const alertData = await alertRes.json();
        setAlertsCount((alertData.alerts || []).length);
      }
      // 4. Fetch registered users
      if (session?.access_token) {
        const usersRes = await fetch(`${API_BASE}/api/auth/users`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData.users || []);
        }
      }
    } catch (err) {
      console.error('Error fetching admin dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveUser = async (user) => {
    setApprovingUserId(user.id);
    try {
      const res = await fetch(`${API_BASE}/api/auth/approve/${user.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, is_approved: true } : u))
        );
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to approve user');
      }
    } catch (err) {
      alert('Error connecting to server to approve account');
    } finally {
      setApprovingUserId(null);
    }
  };

  const handleDeleteUser = async (user) => {
    const userLabel = user.email || user.mail_id || user.full_name || 'this user';
    if (!window.confirm(`Are you sure you want to permanently delete account "${userLabel}"?\n\nThis will remove the user from both the database and Supabase Auth so you can recreate it anytime with the same email.`)) {
      return;
    }

    setDeletingUserId(user.id);
    try {
      const res = await fetch(`${API_BASE}/api/auth/users/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to delete user');
      }
    } catch (err) {
      alert('Error connecting to server to delete account');
    } finally {
      setDeletingUserId(null);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, [session]);

  // Live in last 5 minutes calculation
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const liveLast5Min = buses.filter((b) => {
    if (!b.location?.updated_at) return false;
    const updateTime = new Date(b.location.updated_at).getTime();
    return updateTime > fiveMinAgo;
  }).length;

  if (loading) {
    return <Loader message="Loading campus transport telemetry..." />;
  }

  return (
    <div style={{ padding: '16px 0' }}>
      <div className="flex-between mb-4">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Campus Admin</h2>
          <p className="text-xs text-muted">Fleet health, live telemetry & student grievances</p>
        </div>

        <button
          type="button"
          className="btn btn-outline"
          style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
          onClick={fetchDashboardStats}
          title="Refresh Data"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          marginBottom: '20px'
        }}
      >
        <div className="card" style={{ padding: '14px' }}>
          <div className="flex-between mb-1">
            <span className="text-xs text-muted font-semibold">Total Fleet</span>
            <Bus size={18} color="var(--blue)" />
          </div>
          <span style={{ fontSize: '1.75rem', fontWeight: 800 }}>{buses.length}</span>
          <span className="text-xs text-muted" style={{ display: 'block' }}>Configured buses</span>
        </div>

        <div className="card" style={{ padding: '14px' }}>
          <div className="flex-between mb-1">
            <span className="text-xs text-muted font-semibold">Active (5 min)</span>
            <Activity size={18} color="var(--emerald)" />
          </div>
          <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--emerald)' }}>
            {liveLast5Min}
          </span>
          <span className="text-xs text-muted" style={{ display: 'block' }}>Transmitting GPS</span>
        </div>

        <Link to="/admin/complaints" className="card card-interactive" style={{ padding: '14px', textDecoration: 'none' }}>
          <div className="flex-between mb-1">
            <span className="text-xs text-muted font-semibold">Open Complaints</span>
            <MessageSquare size={18} color="var(--rose)" />
          </div>
          <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--rose)' }}>
            {complaintsCount}
          </span>
          <span className="text-xs text-muted" style={{ display: 'block' }}>Pending resolution</span>
        </Link>

        <Link to="/alerts" className="card card-interactive" style={{ padding: '14px', textDecoration: 'none' }}>
          <div className="flex-between mb-1">
            <span className="text-xs text-muted font-semibold">Campus Alerts</span>
            <AlertTriangle size={18} color="var(--amber)" />
          </div>
          <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--amber)' }}>
            {alertsCount}
          </span>
          <span className="text-xs text-muted" style={{ display: 'block' }}>Active notices</span>
        </Link>
      </div>

      {/* Fleet Live Status Table / List */}
      <div className="card">
        <div className="flex-between mb-3">
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Fleet Real-Time Status</h3>
          <span className="text-xs text-muted">{buses.length} vehicles</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {buses.map((bus) => {
            const isFresh = bus.location?.updated_at &&
              (Date.now() - new Date(bus.location.updated_at).getTime() < 300000);

            return (
              <div
                key={bus.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--gray-50)',
                  border: '1px solid var(--gray-200)'
                }}
              >
                <div>
                  <div className="flex-row">
                    <strong style={{ fontSize: '0.875rem' }}>{bus.plate_no}</strong>
                    <span style={{ fontSize: '0.75rem', color: bus.route?.color || 'var(--blue)' }}>
                      {bus.route?.name || 'Unassigned'}
                    </span>
                  </div>
                  <div className="flex-row text-xs text-muted" style={{ marginTop: '2px' }}>
                    <Clock size={12} />
                    <span>
                      {bus.location?.updated_at
                        ? new Date(bus.location.updated_at).toLocaleTimeString()
                        : 'No recent fix'}
                    </span>
                    {bus.location?.speed_kmh !== undefined && (
                      <span>• {bus.location.speed_kmh} km/h</span>
                    )}
                  </div>
                </div>

                <Badge status={bus.status} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Registered Accounts Management */}
      <div className="card" style={{ marginTop: '20px' }}>
        <div className="flex-between mb-3">
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Registered Accounts Management</h3>
            <p className="text-xs text-muted">Delete any account completely from both database and auth with 1 click</p>
          </div>
          <span className="text-xs text-muted">{users.length} accounts</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {users.map((u) => (
            <div
              key={u.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--gray-50)',
                border: '1px solid var(--gray-200)',
                flexWrap: 'wrap',
                gap: '8px'
              }}
            >
              <div>
                <div className="flex-row" style={{ gap: '8px', marginBottom: '3px' }}>
                  <strong style={{ fontSize: '0.875rem' }}>{u.full_name || 'No Name'}</strong>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: u.role === 'admin' ? 'var(--rose-light)' : u.role === 'driver' ? 'var(--amber-light)' : 'var(--blue-light)',
                      color: u.role === 'admin' ? 'var(--rose)' : u.role === 'driver' ? 'var(--amber)' : 'var(--blue)'
                    }}
                  >
                    {u.role}
                  </span>
                  {u.is_approved === false && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--amber)', fontWeight: 600 }}>
                      (Pending Approval)
                    </span>
                  )}
                </div>

                <div className="flex-row text-xs text-muted" style={{ gap: '12px', flexWrap: 'wrap' }}>
                  {(u.email || u.mail_id) && (
                    <span className="flex-row">
                      <Mail size={12} />
                      <span>{u.email || u.mail_id}</span>
                    </span>
                  )}
                  {u.registration_no && <span>Reg: {u.registration_no}</span>}
                  {u.phone && <span>Ph: {u.phone}</span>}
                </div>
              </div>

              <div className="flex-row" style={{ gap: '8px' }}>
                {u.is_approved === false && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.75rem',
                      background: 'var(--emerald)',
                      borderColor: 'var(--emerald)',
                      color: 'white'
                    }}
                    disabled={approvingUserId === u.id}
                    onClick={() => handleApproveUser(u)}
                  >
                    <Check size={13} />
                    {approvingUserId === u.id ? 'Approving...' : 'Approve Access'}
                  </button>
                )}

                {u.email?.toLowerCase() !== 'hamang2001@gmail.com' ? (
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{
                      padding: '5px 10px',
                      fontSize: '0.75rem',
                      color: 'var(--rose)',
                      borderColor: 'var(--rose)'
                    }}
                    disabled={deletingUserId === u.id}
                    onClick={() => handleDeleteUser(u)}
                  >
                    <Trash2 size={13} />
                    {deletingUserId === u.id ? 'Deleting...' : 'Delete'}
                  </button>
                ) : (
                  <span className="flex-row text-xs" style={{ color: 'var(--blue)', fontWeight: 600 }}>
                    <ShieldCheck size={14} /> Lead Admin
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
