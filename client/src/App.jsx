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
  const { session, role, loading, profile } = useAuth();

  // If auth is loading OR session is present but profile is still resolving,
  // hold with a loader instead of prematurely assuming role = 'student' and kicking user out!
  if (loading || (session && !profile && (!role || role === 'student'))) {
    return <Loader message="Verifying campus credentials..." />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    const fallbackHome = role === 'driver' ? '/driver' : role === 'admin' ? '/admin' : '/';
    return <Navigate to={fallbackHome} replace />;
  }

  return children;
}

/**
 * RoleHome Dispatcher
 * Sends drivers to /driver, admins to /admin, and students to StudentHome
 */
function RoleHome() {
  const { role, session, loading, profile } = useAuth();

  // Wait until profile is fully resolved before deciding which dashboard to display
  if (loading || (session && !profile && (!role || role === 'student'))) {
    return <Loader message="Routing to your dashboard..." />;
  }

  if (role === 'driver') return <Navigate to="/driver" replace />;
  if (role === 'admin') return <Navigate to="/admin" replace />;
  return <StudentHome />;
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
          {/* Smart Root Route */}
          <Route path="/" element={<RoleHome />} />
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
