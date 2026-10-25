import React from 'react';

export default function Badge({ status, variant, children }) {
  const raw = status || variant || 'info';
  const normalized = typeof raw === 'string' ? raw.toLowerCase() : 'info';
  
  const isLive = normalized === 'live';
  const isMock = normalized === 'mock';
  const isOffline = normalized === 'offline';

  const badgeClass = `badge badge-${normalized}`;

  return (
    <span className={badgeClass} role="status">
      {(isLive || isMock || isOffline) && (
        <span className={`pulse-dot ${normalized}`} aria-hidden="true" />
      )}
      {children || (typeof status === 'string' ? status.toUpperCase() : normalized.toUpperCase())}
    </span>
  );
}
