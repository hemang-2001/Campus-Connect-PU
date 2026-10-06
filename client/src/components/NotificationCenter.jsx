import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlertNotifications } from '../context/AlertNotificationContext';
import {
  Bell,
  BellRing,
  CheckCheck,
  Volume2,
  VolumeX,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  ExternalLink,
  Sparkles,
  X
} from 'lucide-react';

export default function NotificationCenter() {
  const {
    alerts,
    unreadCount,
    markAsRead,
    markAllAsRead,
    notificationPermission,
    requestSystemPermission,
    soundEnabled,
    toggleSound,
    triggerTestAlert
  } = useAlertNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleAlertClick = (alert) => {
    if (alert.id && !alert.isTest) {
      markAsRead(alert.id);
    }
    setIsOpen(false);
    navigate('/alerts');
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setIsOpen(!isOpen)}
        title="Alert Notifications"
        aria-label={`Alert Notifications (${unreadCount} unread)`}
        style={{
          position: 'relative',
          padding: '8px',
          color: unreadCount > 0 ? 'var(--text-primary)' : 'var(--gray-600)'
        }}
      >
        {unreadCount > 0 ? (
          <BellRing size={20} color="var(--blue)" />
        ) : (
          <Bell size={20} />
        )}

        {/* Unread Badge Pill */}
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              minWidth: '18px',
              height: '18px',
              borderRadius: '9999px',
              backgroundColor: 'var(--rose)',
              color: '#ffffff',
              fontSize: '0.68rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              boxShadow: '0 0 0 2px #ffffff, 0 2px 4px rgba(239, 68, 68, 0.4)',
              animation: 'badgePulse 2s infinite'
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover / Drawer */}
      {isOpen && (
        <div
          className="notification-center-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: '-10px',
            width: '340px',
            maxWidth: 'calc(100vw - 32px)',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 15px 30px -5px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(15, 23, 42, 0.08)',
            zIndex: 10001,
            overflow: 'hidden',
            animation: 'popoverIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'var(--gray-50)',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 800 }}>Student Alerts</h3>
                {unreadCount > 0 && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      backgroundColor: 'var(--blue-light)',
                      color: 'var(--blue)',
                      padding: '2px 6px',
                      borderRadius: '6px'
                    }}
                  >
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Real-time shuttle notifications</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--blue)',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    padding: '4px 6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <CheckCheck size={14} />
                  <span>Read all</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--gray-400)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
                aria-label="Close notifications"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Controls Bar: Sound, System Notification, Test */}
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: '#ffffff',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
              fontSize: '0.72rem'
            }}
          >
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={toggleSound}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: soundEnabled ? 'var(--blue-light)' : 'var(--gray-100)',
                color: soundEnabled ? 'var(--blue)' : 'var(--gray-600)',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 8px',
                cursor: 'pointer',
                fontWeight: 600
              }}
              title={soundEnabled ? 'Alert chime enabled' : 'Alert chime muted'}
            >
              {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
              <span>{soundEnabled ? 'Chime ON' : 'Muted'}</span>
            </button>

            {/* Browser Push Permission Toggle */}
            {notificationPermission !== 'granted' && (
              <button
                type="button"
                onClick={requestSystemPermission}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'var(--amber-light)',
                  color: '#b45309',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
                title="Enable OS system push notifications"
              >
                <Bell size={12} />
                <span>Enable Push</span>
              </button>
            )}

            {/* Test Alert Simulator Button */}
            <button
              type="button"
              onClick={() => triggerTestAlert('warning')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'var(--gray-100)',
                color: 'var(--gray-700)',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 8px',
                cursor: 'pointer',
                fontWeight: 600
              }}
              title="Test realistic mobile app alert notification"
            >
              <Sparkles size={12} color="var(--amber)" />
              <span>Test Alert</span>
            </button>
          </div>

          {/* Alerts List */}
          <div
            style={{
              maxHeight: '290px',
              overflowY: 'auto',
              padding: '6px 0'
            }}
          >
            {alerts.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Bell size={24} style={{ opacity: 0.4, margin: '0 auto 6px auto' }} />
                <p style={{ fontSize: '0.8rem', fontWeight: 600 }}>No campus alerts right now</p>
                <p style={{ fontSize: '0.72rem' }}>All university shuttles on normal schedule</p>
              </div>
            ) : (
              alerts.slice(0, 6).map((alert) => {
                const isCrit = alert.severity === 'critical';
                const isWarn = alert.severity === 'warning';
                const accentColor = isCrit ? 'var(--rose)' : isWarn ? 'var(--amber)' : 'var(--blue)';
                const accentBg = isCrit ? 'var(--rose-light)' : isWarn ? 'var(--amber-light)' : 'var(--blue-light)';

                return (
                  <div
                    key={alert.id}
                    onClick={() => handleAlertClick(alert)}
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid var(--gray-100)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'flex-start'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--gray-50)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '8px',
                        backgroundColor: accentBg,
                        color: accentColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}
                    >
                      {isCrit ? <AlertCircle size={15} /> : isWarn ? <AlertTriangle size={15} /> : <Info size={15} />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <h4
                          style={{
                            fontSize: '0.8125rem',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {alert.title}
                        </h4>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                          {formatTime(alert.created_at)}
                        </span>
                      </div>

                      <p
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.35,
                          marginTop: '2px',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {alert.body}
                      </p>

                      {alert.route?.name && (
                        <div style={{ marginTop: '4px' }}>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              color: 'var(--blue)',
                              backgroundColor: 'var(--blue-light)',
                              padding: '1px 6px',
                              borderRadius: '4px'
                            }}
                          >
                            {alert.route.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer View All */}
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--gray-50)',
              borderTop: '1px solid var(--border-subtle)',
              textAlign: 'center'
            }}
          >
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/alerts');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--blue)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>View All Campus Alerts</span>
              <ExternalLink size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
