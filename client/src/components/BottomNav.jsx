import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAlertNotifications } from '../context/AlertNotificationContext';
import { MapPin, Bell, MessageSquare, User, Radio, BarChart3, ClipboardList } from 'lucide-react';

export default function BottomNav() {
  const { role } = useAuth();
  const { unreadCount } = useAlertNotifications();

  const renderAlertIcon = () => (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <Bell size={20} />
      {unreadCount > 0 && (
        <span
          style={{
            position: 'absolute',
            top: '-5px',
            right: '-9px',
            minWidth: '16px',
            height: '16px',
            borderRadius: '9999px',
            backgroundColor: 'var(--rose)',
            color: '#ffffff',
            fontSize: '0.625rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            boxShadow: '0 0 0 1.5px #ffffff'
          }}
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </div>
  );

  return (
    <nav className="bottom-nav" aria-label="Bottom Navigation">
      {/* Student Links */}
      {role === 'student' && (
        <>
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
            aria-label="Live Map"
          >
            <MapPin size={20} />
            <span>Map</span>
          </NavLink>

          <NavLink
            to="/complaints"
            className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
            aria-label="Complaints"
          >
            <MessageSquare size={20} />
            <span>Complaints</span>
          </NavLink>

          <NavLink
            to="/alerts"
            className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
            aria-label={`Alerts ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
          >
            {renderAlertIcon()}
            <span>Alerts</span>
          </NavLink>


          <NavLink
            to="/profile"
            className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
            aria-label="Profile"
          >
            <User size={20} />
            <span>Profile</span>
          </NavLink>
        </>
      )}

      {/* Driver Links */}
      {role === 'driver' && (
        <>
          <NavLink
            to="/driver"
            end
            className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
            aria-label="Driver Broadcast"
          >
            <Radio size={20} />
            <span>Broadcast</span>
          </NavLink>

          <NavLink
            to="/alerts"
            className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
            aria-label={`Alerts ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
          >
            {renderAlertIcon()}
            <span>Alerts</span>
          </NavLink>

          <NavLink
            to="/profile"
            className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
            aria-label="Profile"
          >
            <User size={20} />
            <span>Profile</span>
          </NavLink>
        </>
      )}

      {/* Admin Links */}
      {role === 'admin' && (
        <>
          <NavLink
            to="/admin"
            end
            className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
            aria-label="Admin Dashboard"
          >
            <BarChart3 size={20} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/admin/complaints"
            className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
            aria-label="Admin Complaints"
          >
            <ClipboardList size={20} />
            <span>Complaints</span>
          </NavLink>

          <NavLink
            to="/alerts"
            className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
            aria-label={`Manage Alerts ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
          >
            {renderAlertIcon()}
            <span>Alerts</span>
          </NavLink>


          <NavLink
            to="/profile"
            className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
            aria-label="Profile"
          >
            <User size={20} />
            <span>Profile</span>
          </NavLink>
        </>
      )}
    </nav>
  );
}
