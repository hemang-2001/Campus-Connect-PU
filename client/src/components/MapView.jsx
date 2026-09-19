import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

// Recenter map smoothly when selected bus changes
function ChangeMapView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom || map.getZoom(), { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

// Create custom DivIcon for Buses
function createBusIcon(status = 'LIVE', heading = 0) {
  const colorClass = status.toLowerCase(); // 'live' -> blue, 'mock' -> amber, 'offline' -> gray
  return L.divIcon({
    className: 'custom-leaflet-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
    html: `
      <div class="bus-marker-pin ${colorClass}" style="width: 36px; height: 36px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${heading || 0}deg); transition: transform 0.4s ease;">
          <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10z"/>
          <circle cx="7.5" cy="15.5" r="1.5" fill="currentColor"/>
          <circle cx="16.5" cy="15.5" r="1.5" fill="currentColor"/>
          <path d="M4 9h16"/>
        </svg>
      </div>
    `
  });
}

// Create custom DivIcon for Stops
function createStopIcon(seq) {
  return L.divIcon({
    className: 'custom-stop-marker',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
    html: `
      <div class="stop-marker-pin" style="width: 26px; height: 26px;">
        ${seq || '•'}
      </div>
    `
  });
}

const DEFAULT_CENTER = [28.6139, 77.2090]; // Delhi Campus Coordinates

export default function MapView({ buses = [], stops = [], selectedBus, onSelectBus }) {
  // Determine center from selected bus or fallback
  const mapCenter = selectedBus?.location?.lat && selectedBus?.location?.lng
    ? [selectedBus.location.lat, selectedBus.location.lng]
    : DEFAULT_CENTER;

  // Extract stops polyline coordinates if stops exist
  const stopCoordinates = stops && stops.length > 0
    ? stops.map((s) => [s.lat, s.lng])
    : [];

  return (
    <div className="map-wrap">
      <MapContainer
        center={mapCenter}
        zoom={15}
        scrollWheelZoom={false}
        className="map-inner"
      >
        <ChangeMapView center={mapCenter} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Route Polyline */}
        {stopCoordinates.length > 1 && (
          <Polyline
            positions={stopCoordinates}
            pathOptions={{
              color: '#2563eb',
              weight: 4,
              opacity: 0.7,
              dashArray: '6, 8'
            }}
          />
        )}

        {/* Bus Stop Markers */}
        {stops.map((stop) => (
          <Marker
            key={stop.id || `${stop.lat}-${stop.lng}`}
            position={[stop.lat, stop.lng]}
            icon={createStopIcon(stop.seq)}
          >
            <Popup>
              <div style={{ padding: '4px', textAlign: 'center' }}>
                <strong style={{ display: 'block', fontSize: '13px', color: '#1e293b' }}>
                  {stop.name}
                </strong>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Stop #{stop.seq}
                </span>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Bus Markers */}
        {buses.map((bus) => {
          if (!bus.location?.lat || !bus.location?.lng) return null;
          const pos = [bus.location.lat, bus.location.lng];
          const icon = createBusIcon(bus.status, bus.location.heading);

          return (
            <Marker
              key={bus.id}
              position={pos}
              icon={icon}
              eventHandlers={{
                click: () => onSelectBus?.(bus)
              }}
            >
              <Popup>
                <div style={{ minWidth: 140, padding: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <strong style={{ fontSize: 13 }}>{bus.plate_no}</strong>
                    <span style={{ fontSize: 10, fontWeight: 700, color: bus.status === 'LIVE' ? '#2563eb' : '#f59e0b' }}>
                      {bus.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#475569' }}>
                    Route: {bus.route?.name || 'Campus Shuttle'}
                  </div>
                  <div style={{ fontSize: 11, color: '#475569' }}>
                    Speed: {bus.location.speed_kmh} km/h
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
