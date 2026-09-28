import React, { useState, useEffect } from 'react';

export default function Loader({ message = 'Loading...' }) {
  const [showEscape, setShowEscape] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowEscape(true);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  const handleClearSession = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}
    window.location.href = '/login';
  };

  return (
    <div className="state-container" role="status" aria-live="polite">
      <div className="spinner" />
      <p className="text-sm font-semibold text-muted">{message}</p>
      {showEscape && (
        <div style={{ marginTop: '16px', textAlign: 'center', animation: 'fadeIn 0.3s ease-in' }}>
          <p className="text-xs text-muted" style={{ marginBottom: '8px' }}>
            Taking longer than expected?
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn btn-secondary text-xs"
              style={{ padding: '6px 12px' }}
            >
              Reload Page
            </button>
            <button
              type="button"
              onClick={handleClearSession}
              className="btn btn-outline text-xs"
              style={{ padding: '6px 12px', color: '#e11d48', borderColor: '#fca5a5' }}
            >
              Sign Out & Return to Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
