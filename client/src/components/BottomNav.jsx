import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MapPin, Bell, MessageSquare, User, Radio, BarChart3, ClipboardList } from 'lucide-react';

export default function BottomNav() {
  const { role } = useAuth();

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
            aria-label="Alerts"
          >
            <Bell size={20} />
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
            aria-label="Alerts"
          >
            <Bell size={20} />
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
            aria-label="Manage Alerts"
          >
            <Bell size={20} />
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
