import React from 'react';
import Badge from './Badge';
import { Bus, Gauge, Clock, Users, MapPin } from 'lucide-react';
import { getBusETA } from '../lib/eta';

function formatRelativeTime(dateString) {
  if (!dateString) return 'No signal';
  const diffSec = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (diffSec < 5) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

export default function BusCard({ bus, stops = [], isSelected, onSelect }) {
  const routeName = bus.route?.name || 'Unassigned Route';
  const routeColor = bus.route?.color || '#2563eb';
  const speed = bus.location?.speed_kmh ?? 0;
  const lastUpdate = formatRelativeTime(bus.location?.updated_at);
  const etaInfo = getBusETA(bus, stops);

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

      {/* Next Stop & ETA Banner */}
      {etaInfo?.nextStop ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: etaInfo.isArriving ? 'var(--emerald-light)' : 'var(--blue-light)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 10px',
            marginBottom: '8px',
            border: `1px solid ${
              etaInfo.isArriving ? 'rgba(16, 185, 129, 0.25)' : 'rgba(37, 99, 235, 0.15)'
            }`
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
            <MapPin
              size={14}
              color={etaInfo.isArriving ? 'var(--emerald)' : 'var(--blue)'}
              style={{ flexShrink: 0 }}
            />
            <span
              style={{
                fontSize: '0.8125rem',
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                overflow: 'hidden'
              }}
            >
              Next: <strong>{etaInfo.nextStop.name}</strong>
            </span>
          </div>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              whiteSpace: 'nowrap',
              backgroundColor: etaInfo.isArriving ? 'var(--emerald)' : 'var(--blue)',
              color: '#ffffff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}
          >
            {etaInfo.etaText}
          </span>
        </div>
      ) : bus.status === 'OFFLINE' ? (
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--gray-500)',
            marginBottom: '8px',
            fontStyle: 'italic'
          }}
        >
          Shuttle is currently offline
        </div>
      ) : null}

      <div
        className="flex-between text-xs text-muted"
        style={{
          borderTop: '1px solid var(--gray-100)',
          paddingTop: '8px',
          marginTop: '4px'
        }}
      >
        <span className="flex-row">
          <Gauge size={14} />
          <span>{speed} km/h</span>
        </span>

        {etaInfo?.distanceText && etaInfo.distanceText !== '--' ? (
          <span className="flex-row">
            <MapPin size={14} />
            <span>{etaInfo.distanceText} away</span>
          </span>
        ) : (
          <span className="flex-row">
            <Clock size={14} />
            <span>{lastUpdate}</span>
          </span>
        )}

        <span className="flex-row">
          <Users size={14} />
          <span>Cap: {bus.capacity}</span>
        </span>
      </div>
    </div>
  );
}
