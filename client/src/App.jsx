import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AlertNotificationProvider } from './context/AlertNotificationContext';

import Layout from './components/Layout';
import Loader from './components/Loader';
import ErrorBoundary from './components/ErrorBoundary';
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
    return <Loader message="Verifying campus credentials..." />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const normalizedRole = (role || 'student').toLowerCase();

  if (allowedRoles && !allowedRoles.map((r) => r.toLowerCase()).includes(normalizedRole)) {
    const fallbackHome = normalizedRole === 'driver' ? '/driver' : normalizedRole === 'admin' ? '/admin' : '/';
    return <Navigate to={fallbackHome} replace />;
  }

  return children;
}

/**
 * RoleHome Dispatcher
 * Sends drivers to /driver, admins to /admin, and students to StudentHome
 */
function RoleHome() {
  const { role, loading } = useAuth();

  if (loading) {
    return <Loader message="Routing to your dashboard..." />;
  }

  const normalizedRole = (role || 'student').toLowerCase();
  if (normalizedRole === 'driver') return <Navigate to="/driver" replace />;
  if (normalizedRole === 'admin') return <Navigate to="/admin" replace />;
  return <StudentHome />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AlertNotificationProvider>
        <ErrorBoundary>
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
                  <ErrorBoundary>
                    <Complaints />
                  </ErrorBoundary>
                </Protected>
              }
            />
            <Route
              path="/complaints/new"
              element={
                <Protected allowedRoles={['student']}>
                  <ErrorBoundary>
                    <NewComplaint />
                  </ErrorBoundary>
                </Protected>
              }
            />

            {/* Shared Authenticated Routes */}
            <Route
              path="/alerts"
              element={
                <ErrorBoundary>
                  <Alerts />
                </ErrorBoundary>
              }
            />
            <Route
              path="/profile"
              element={
                <ErrorBoundary>
                  <Profile />
                </ErrorBoundary>
              }
            />

            {/* Driver Route */}
            <Route
              path="/driver"
              element={
                <Protected allowedRoles={['driver', 'admin']}>
                  <ErrorBoundary>
                    <DriverDashboard />
                  </ErrorBoundary>
                </Protected>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <Protected allowedRoles={['admin']}>
                  <ErrorBoundary>
                    <AdminDashboard />
                  </ErrorBoundary>
                </Protected>
              }
            />
            <Route
              path="/admin/complaints"
              element={
                <Protected allowedRoles={['admin']}>
                  <ErrorBoundary>
                    <ComplaintsAdmin />
                  </ErrorBoundary>
                </Protected>
              }
            />
          </Route>

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ErrorBoundary>
      </AlertNotificationProvider>
    </BrowserRouter>
  );
}

