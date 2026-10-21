import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAlertNotifications } from '../context/AlertNotificationContext';
import { Bus, AlertTriangle, AlertCircle, Info, X, ExternalLink, ChevronRight } from 'lucide-react';

export default function AppNotificationBanner() {
  const { activeBannerAlert, dismissBanner, markAsRead } = useAlertNotifications();
  const navigate = useNavigate();

  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(100);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
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
      if (!isHovered && !isDragging) {
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
  }, [activeBannerAlert, isHovered, isDragging, dismissBanner]);

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

  // Interactive touch swipe-up to dismiss with visual feedback
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (touchStartY.current !== null) {
      const diffY = e.touches[0].clientY - touchStartY.current;
      // Track upward drag with 1:1 motion; dampen downward drag
      if (diffY < 0) {
        setDragY(diffY);
      } else {
        setDragY(diffY * 0.25);
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchStartY.current !== null) {
      if (dragY < -32) {
        // Dragged up enough to dismiss smoothly
        dismissBanner();
      }
      setDragY(0);
      setIsDragging(false);
      touchStartY.current = null;
    }
  };

  // Dynamic transform during touch drag vs normal state
  const dragTransform = isDragging
    ? `translateY(${dragY}px) scale(${1 - Math.min(0.08, Math.abs(dragY) * 0.001)})`
    : undefined;

  const dragOpacity = isDragging && dragY < 0
    ? Math.max(0.1, 1 + dragY / 90)
    : 1;

  return (
    <aside
      aria-label="Campus Alert Notification"
      role="alert"
      className="app-notification-banner"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.96)',
        color: '#ffffff',
        borderRadius: '16px',
        boxShadow: `0 16px 36px -6px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.12), 0 0 20px ${
          isCrit ? 'rgba(239, 68, 68, 0.25)' : isWarn ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.18)'
        }`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        overflow: 'hidden',
        animation: !isDragging ? 'slideDownBanner 0.35s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
        transform: dragTransform,
        opacity: dragOpacity,
        transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
        cursor: 'pointer'
      }}
      onClick={handleOpenAlert}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
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

      {/* Subtle Mobile Drag Pill Handle */}
      <div
        style={{
          width: '32px',
          height: '3px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          margin: '5px auto -2px auto'
        }}
        aria-hidden="true"
      />

      <div style={{ padding: '8px 12px 10px 12px' }}>
        {/* App Header Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            marginBottom: '6px'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minWidth: 0,
              flex: '1 1 auto',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '7px',
                backgroundColor: accentColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0,
                boxShadow: `0 2px 6px ${accentColor}66`
              }}
            >
              <Bus size={13} />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                minWidth: 0,
                overflow: 'hidden',
                whiteSpace: 'nowrap'
              }}
            >
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  color: '#e2e8f0',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                CAMPUS CONNECT
              </span>
              <span style={{ color: '#64748b', fontSize: '0.65rem', flexShrink: 0 }}>•</span>
              <span
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 5px',
                  borderRadius: '4px',
                  backgroundColor: accentBg,
                  color: accentColor,
                  border: `1px solid ${accentColor}44`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  flexShrink: 0,
                  whiteSpace: 'nowrap'
                }}
              >
                {isCrit ? <AlertCircle size={9} /> : isWarn ? <AlertTriangle size={9} /> : <Info size={9} />}
                {isCrit ? 'CRITICAL' : isWarn ? 'WARNING' : 'NOTICE'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <span
              style={{
                fontSize: '0.68rem',
                color: '#94a3b8',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap'
              }}
            >
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  backgroundColor: accentColor,
                  animation: 'pulseGlow 1.5s infinite',
                  flexShrink: 0
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
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#cbd5e1',
                borderRadius: '50%',
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0
              }}
              aria-label="Dismiss alert"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Alert Body */}
        <div style={{ paddingLeft: '1px', paddingRight: '1px' }}>
          <h4
            style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              color: '#f8fafc',
              marginBottom: '3px',
              lineHeight: 1.3,
              wordBreak: 'break-word'
            }}
          >
            {activeBannerAlert.title}
          </h4>

          <p
            style={{
              fontSize: '0.78rem',
              color: '#cbd5e1',
              lineHeight: 1.38,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
              margin: 0
            }}
          >
            {activeBannerAlert.body}
          </p>

          {activeBannerAlert.route?.name && (
            <div style={{ marginTop: '5px' }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  color: '#93c5fd',
                  backgroundColor: 'rgba(37, 99, 235, 0.2)',
                  padding: '2px 7px',
                  borderRadius: '9999px',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  display: 'inline-block',
                  maxWidth: '100%',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
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
            gap: '8px',
            marginTop: '8px',
            paddingTop: '7px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <span
            style={{
              fontSize: '0.68rem',
              color: '#64748b',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              flex: 1
            }}
          >
            {activeBannerAlert.isTest ? '🧪 Simulated Alert' : 'Tap to open alerts feed'}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
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
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 6px',
                whiteSpace: 'nowrap'
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
                borderRadius: '7px',
                padding: '4px 9px',
                fontSize: '0.72rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: `0 2px 6px ${accentColor}66`
              }}
            >
              <span>View Alert</span>
              <ChevronRight size={13} />
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
