import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BottomNav from './BottomNav';
import InstallPrompt from './InstallPrompt';
import { Bus, LogOut, ShieldAlert } from 'lucide-react';

export default function Layout() {
  const { user, profile, role, signOut } = useAuth();
  const location = useLocation();

  // Certain views (like StudentHome map) want edge-to-edge padding
  const isMapRoute = location.pathname === '/';

  return (
    <div className="app-container">
      {/* Topbar Header */}
      <header className="topbar">
        <Link to="/" className="topbar-brand">
          <div className="brand-icon-wrap">
            <Bus size={20} />
          </div>
          <span>Campus Connect</span>
        </Link>

        <div className="topbar-actions">
          {role && (
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '3px 8px',
                borderRadius: '6px',
                background: role === 'admin' ? '#fee2e2' : role === 'driver' ? '#fef3c7' : '#dbeafe',
                color: role === 'admin' ? '#991b1b' : role === 'driver' ? '#92400e' : '#1e40af'
              }}
            >
              {role}
            </span>
          )}

          <button
            type="button"
            className="btn btn-ghost"
            onClick={signOut}
            title="Sign Out"
            style={{ padding: '6px' }}
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Content View */}
      <main className={`main-content ${isMapRoute ? 'no-pad' : ''}`}>
        <Outlet />
      </main>

          {/* PWA Floating Install Prompt */}
      <InstallPrompt />

      {/* Role-Aware Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
