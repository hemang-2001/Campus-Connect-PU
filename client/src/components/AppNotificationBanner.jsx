import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlertNotifications } from '../context/AlertNotificationContext';
import { Bus, AlertTriangle, AlertCircle, Info, X, ExternalLink, ChevronRight } from 'lucide-react';

export default function AppNotificationBanner() {
  const { activeBannerAlert, dismissBanner, markAsRead } = useAlertNotifications();
  const navigate = useNavigate();

  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(100);
  const touchStartY = useRef(null);

  // Auto-dismiss countdown timer with pause-on-hover
  useEffect(() => {
    if (!activeBannerAlert) {
      setProgress(100);
      return;
    }

    // Critical alerts stay visible longer (10s), info/warning for 7s
    const totalDuration = activeBannerAlert.severity === 'critical' ? 10000 : 7000;
    const intervalTime = 50;
    const decrement = (intervalTime / totalDuration) * 100;

    const timer = setInterval(() => {
      if (!isHovered) {
        setProgress((prev) => {
          if (prev <= decrement) {
            clearInterval(timer);
            dismissBanner();
            return 0;
          }
          return prev - decrement;
        });
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [activeBannerAlert, isHovered, dismissBanner]);

  if (!activeBannerAlert) return null;

  const isCrit = activeBannerAlert.severity === 'critical';
  const isWarn = activeBannerAlert.severity === 'warning';

  const accentColor = isCrit ? '#ef4444' : isWarn ? '#f59e0b' : '#3b82f6';
  const accentBg = isCrit ? 'rgba(239, 68, 68, 0.15)' : isWarn ? 'rgba(245, 158, 11, 0.15)' : 'rgba(59, 130, 246, 0.15)';

  const handleOpenAlert = (e) => {
    e.stopPropagation();
    if (activeBannerAlert.id && !activeBannerAlert.isTest) {
      markAsRead(activeBannerAlert.id);
    }
    dismissBanner();
    navigate('/alerts');
  };

  // Touch swipe-up to dismiss
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    if (touchStartY.current !== null) {
      const diffY = touchStartY.current - e.changedTouches[0].clientY;
      // If swiped up by more than 35px, dismiss
      if (diffY > 35) {
        dismissBanner();
      }
      touchStartY.current = null;
    }
  };

  return (
    <aside
      aria-label="Campus Alert Notification"
      role="alert"
      className="app-notification-banner"
      style={{
        position: 'fixed',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 24px)',
        maxWidth: '460px',
        zIndex: 10000,
        backgroundColor: 'rgba(15, 23, 42, 0.96)',
        color: '#ffffff',
        borderRadius: '18px',
        boxShadow: `0 20px 35px -5px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1), 0 0 25px ${isCrit ? 'rgba(239, 68, 68, 0.3)' : isWarn ? 'rgba(245, 158, 11, 0.25)' : 'rgba(59, 130, 246, 0.2)'}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        overflow: 'hidden',
        animation: 'slideDownBanner 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: 'pointer'
      }}
      onClick={handleOpenAlert}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Accent Strip */}
      <div
        style={{
          height: '3px',
          width: '100%',
          background: isCrit
            ? 'linear-gradient(90deg, #ef4444, #f43f5e)'
            : isWarn
            ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
            : 'linear-gradient(90deg, #2563eb, #38bdf8)'
        }}
      />

      <div style={{ padding: '12px 14px 10px 14px' }}>
        {/* App Header Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '8px',
                backgroundColor: accentColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: `0 2px 8px ${accentColor}66`
              }}
            >
              <Bus size={15} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.04em', color: '#e2e8f0' }}>
                CAMPUS CONNECT
              </span>
              <span style={{ color: '#64748b', fontSize: '0.7rem' }}>•</span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: accentBg,
                  color: accentColor,
                  border: `1px solid ${accentColor}44`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {isCrit ? <AlertCircle size={10} /> : isWarn ? <AlertTriangle size={10} /> : <Info size={10} />}
                {isCrit ? 'CRITICAL' : isWarn ? 'WARNING' : 'NOTICE'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: accentColor,
                  animation: 'pulseGlow 1.5s infinite'
                }}
              />
              Now
            </span>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dismissBanner();
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#cbd5e1',
                borderRadius: '50%',
                width: '22px',
                height: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0
              }}
              aria-label="Dismiss alert"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Alert Body */}
        <div style={{ paddingLeft: '2px', paddingRight: '2px' }}>
          <h4
            style={{
              fontSize: '0.9rem',
              fontWeight: 700,
              color: '#f8fafc',
              marginBottom: '3px',
              lineHeight: 1.3
            }}
          >
            {activeBannerAlert.title}
          </h4>

          <p
            style={{
              fontSize: '0.8rem',
              color: '#cbd5e1',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {activeBannerAlert.body}
          </p>

          {activeBannerAlert.route?.name && (
            <div style={{ marginTop: '6px' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: '#93c5fd',
                  backgroundColor: 'rgba(37, 99, 235, 0.2)',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}
              >
                📍 {activeBannerAlert.route.name}
              </span>
            </div>
          )}
        </div>

        {/* Action Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '10px',
            paddingTop: '8px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
            {activeBannerAlert.isTest ? '🧪 Simulated Alert' : 'Tap to open alerts feed'}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dismissBanner();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 8px'
              }}
            >
              Dismiss
            </button>

            <button
              type="button"
              onClick={handleOpenAlert}
              style={{
                background: accentColor,
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '4px 10px',
                fontSize: '0.75rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                boxShadow: `0 2px 6px ${accentColor}66`
              }}
            >
              <span>View Alert</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Auto-Dismiss Shrinking Progress Bar */}
      <div
        style={{
          height: '2.5px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          width: '100%',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            backgroundColor: accentColor,
            transition: 'width 0.05s linear'
          }}
        />
      </div>
    </aside>
  );
}
