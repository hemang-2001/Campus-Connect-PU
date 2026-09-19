import React from 'react';
import { Inbox } from 'lucide-react';

export default function EmptyState({ title = 'No records found', message, action }) {
  return (
    <div className="state-container">
      <div style={{ color: 'var(--gray-400)', marginBottom: '8px' }}>
        <Inbox size={40} />
      </div>
      <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>{title}</h4>
      {message && <p className="text-sm text-muted" style={{ maxWidth: 280 }}>{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
