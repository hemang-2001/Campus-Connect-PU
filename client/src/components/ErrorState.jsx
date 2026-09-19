import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

export default function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="state-container" role="alert">
      <div style={{ color: 'var(--rose)', marginBottom: '8px' }}>
        <AlertTriangle size={36} />
      </div>
      <h3 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{title}</h3>
      {message && <p className="text-sm text-muted" style={{ maxWidth: 320 }}>{message}</p>}
      {onRetry && (
        <button type="button" className="btn btn-outline mt-2" onClick={onRetry}>
          <RotateCw size={16} /> Try Again
        </button>
      )}
    </div>
  );
}
