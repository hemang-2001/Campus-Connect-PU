import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

import Layout from './components/Layout';
import Loader from './components/Loader';
import Login from './pages/Login';
import Register from './pages/Register';
import Alerts from './pages/Alerts';

import StudentHome from './pages/student/StudentHome';
import Complaints from './pages/student/Complaints';
import NewComplaint from './pages/student/NewComplaint';
import Profile from './pages/student/Profile';

import DriverDashboard from './pages/driver/DriverDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import ComplaintsAdmin from './pages/admin/ComplaintsAdmin';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

/**
 * Protected Route Guard
 * Enforces authenticated session & authorized role list.
 */
function Protected({ allowedRoles, children }) {
  const { session, role, loading } = useAuth();

  if (loading) {
    return <Loader message="Checking authentication status..." />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    const fallbackHome = role === 'driver' ? '/driver' : role === 'admin' ? '/admin' : '/';

    return (
      <div className="state-container" style={{ padding: '60px 20px' }}>
        <div style={{ color: 'var(--rose)', marginBottom: '12px' }}>
          <ShieldAlert size={48} />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Unauthorized for your role</h2>
        <p className="text-sm text-muted" style={{ maxWidth: 320 }}>
          Your current account role (<strong>{role}</strong>) does not have permission to access this section.
        </p>
        <Link to={fallbackHome} className="btn btn-primary mt-4">
          <ArrowLeft size={16} /> Return to your Dashboard
        </Link>
      </div>
    );
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Authentication Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Authenticated Application Shell */}
        <Route
          element={
            <Protected>
              <Layout />
            </Protected>
          }
        >
          {/* Student Routes */}
          <Route
            path="/"
            element={
              <Protected allowedRoles={['student']}>
                <StudentHome />
              </Protected>
            }
          />
          <Route
            path="/complaints"
            element={
              <Protected allowedRoles={['student']}>
                <Complaints />
              </Protected>
            }
          />
          <Route
            path="/complaints/new"
            element={
              <Protected allowedRoles={['student']}>
                <NewComplaint />
              </Protected>
            }
          />

          {/* Shared Authenticated Routes */}
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/profile" element={<Profile />} />

          {/* Driver Route */}
          <Route
            path="/driver"
            element={
              <Protected allowedRoles={['driver', 'admin']}>
                <DriverDashboard />
              </Protected>
            }
          />

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <Protected allowedRoles={['admin']}>
                <AdminDashboard />
              </Protected>
            }
          />
          <Route
            path="/admin/complaints"
            element={
              <Protected allowedRoles={['admin']}>
                <ComplaintsAdmin />
              </Protected>
            }
          />
        </Route>

        {/* Catch-all Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
