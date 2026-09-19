import React from 'react';

export default function Badge({ status, variant, children }) {
  const normalized = (status || variant || 'info').toLowerCase();
  
  const isLive = normalized === 'live';
  const isMock = normalized === 'mock';
  const isOffline = normalized === 'offline';

  let badgeClass = `badge badge-${normalized}`;

  return (
    <span className={badgeClass} role="status">
      {(isLive || isMock || isOffline) && (
        <span className={`pulse-dot ${normalized}`} aria-hidden="true" />
      )}
      {children || status?.toUpperCase()}
    </span>
  );
}
