import React from 'react';

export default function Loader({ message = 'Loading...' }) {
  return (
    <div className="state-container" role="status" aria-live="polite">
      <div className="spinner" />
      <p className="text-sm font-semibold text-muted">{message}</p>
    </div>
  );
}
