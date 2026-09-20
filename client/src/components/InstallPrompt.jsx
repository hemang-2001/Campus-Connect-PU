import React, { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // 1. If already installed or running standalone, do not show prompt
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      return;
    }

    // 2. Check if user dismissed prompt recently (24 hours)
    const dismissedUntil = localStorage.getItem('pwa_prompt_dismissed_until');
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) {
      return;
    }

    // 3. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari =
      userAgent.includes('safari') &&
      !userAgent.includes('chrome') &&
      !userAgent.includes('crios') &&
      !userAgent.includes('fxios');

    if (isIosDevice && isSafari) {
      setIsIOS(true);
      // Show discrete banner after a short delay
      const timer = setTimeout(() => setIsVisible(true), 3000);
      return () => clearTimeout(timer);
    }

    // 4. Capture native beforeinstallprompt on Android / Chromium
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Wait 2.5 seconds after page load before displaying prompt
      setTimeout(() => setIsVisible(true), 2500);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Auto-hide if installed during session
    window.addEventListener('appinstalled', () => {
      setIsVisible(false);
      setDeferredPrompt(null);
      console.log('[PWA] Campus Connect installed successfully.');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (!deferredPrompt) return;

    // Show native prompt
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] User response to install:', outcome);

    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setShowIOSGuide(false);
    // Dismiss for 24 hours
    localStorage.setItem('pwa_prompt_dismissed_until', String(Date.now() + 24 * 60 * 60 * 1000));
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Floating Install Prompt Banner */}
      <div
        className="card"
        style={{
          position: 'fixed',
          bottom: 'calc(76px + var(--safe-bottom))',
          left: '16px',
          right: '16px',
          maxWidth: '448px',
          margin: '0 auto',
          zIndex: 1100,
          padding: '12px 14px',
          background: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1.5px solid rgba(37, 99, 235, 0.25)',
          boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.18)',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          {/* Icon + Text */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <img
              src="/icons/icon-192.svg"
              alt="Campus Connect"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
              }}
            />
            <div style={{ minWidth: 0 }}>
              <strong style={{ fontSize: '0.875rem', display: 'block', color: 'var(--text-primary)' }}>
                Install Campus Connect
              </strong>
              <p
                className="text-xs text-muted"
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  margin: 0
                }}
              >
                Fast full-screen tracking & alerts
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleInstallClick}
              style={{
                padding: '6px 12px',
                fontSize: '0.8125rem',
                fontWeight: 700,
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <Download size={14} />
              <span>Install</span>
            </button>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleDismiss}
              aria-label="Close install prompt"
              style={{
                padding: '6px',
                color: 'var(--gray-400)',
                borderRadius: '50%'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Instructions Modal */}
      {showIOSGuide && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 1200,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '440px',
              padding: '20px',
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-float)',
              marginBottom: 'var(--safe-bottom)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-between mb-3">
              <strong style={{ fontSize: '1.0625rem' }}>Install on iPhone / iPad</strong>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowIOSGuide(false)}
                style={{ padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <ol style={{ paddingLeft: '20px', fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--gray-700)' }}>
              <li style={{ marginBottom: '8px' }}>
                Tap the <strong>Share</strong> button <Share size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> at the bottom of Safari.
              </li>
              <li style={{ marginBottom: '8px' }}>
                Scroll down and tap <strong>Add to Home Screen</strong>.
              </li>
              <li>
                Tap <strong>Add</strong> in the top right corner.
              </li>
            </ol>

            <button
              type="button"
              className="btn btn-primary btn-full mt-4"
              onClick={() => setShowIOSGuide(false)}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
