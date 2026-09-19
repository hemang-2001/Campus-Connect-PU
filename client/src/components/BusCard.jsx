import React from 'react';
import Badge from './Badge';
import { Bus, Gauge, Clock, Users } from 'lucide-react';

function formatRelativeTime(dateString) {
  if (!dateString) return 'No signal';
  const diffSec = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (diffSec < 5) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

export default function BusCard({ bus, isSelected, onSelect }) {
  const routeName = bus.route?.name || 'Unassigned Route';
  const routeColor = bus.route?.color || '#2563eb';
  const speed = bus.location?.speed_kmh ?? 0;
  const lastUpdate = formatRelativeTime(bus.location?.updated_at);

  return (
    <div
      className={`card card-interactive ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect?.(bus)}
      style={{
        borderLeft: `4px solid ${routeColor}`,
        borderColor: isSelected ? 'var(--blue)' : undefined,
        boxShadow: isSelected ? '0 0 0 2px var(--blue-glow)' : undefined
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(bus);
        }
      }}
    >
      <div className="flex-between mb-2">
        <div className="flex-row">
          <div
            style={{
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--gray-100)',
              color: 'var(--gray-700)',
              display: 'flex'
            }}
          >
            <Bus size={18} />
          </div>
          <div>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>{bus.plate_no}</h4>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: routeColor
              }}
            >
              {routeName}
            </span>
          </div>
        </div>

        <Badge status={bus.status} />
      </div>

      <div
        className="flex-between text-xs text-muted"
        style={{
          borderTop: '1px solid var(--gray-100)',
          paddingTop: '8px',
          marginTop: '8px'
        }}
      >
        <span className="flex-row">
          <Gauge size={14} />
          <span>{speed} km/h</span>
        </span>

        <span className="flex-row">
          <Clock size={14} />
          <span>{lastUpdate}</span>
        </span>

        <span className="flex-row">
          <Users size={14} />
          <span>Cap: {bus.capacity}</span>
        </span>
      </div>
    </div>
  );
}
