import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Locate, LocateFixed, Loader2 } from 'lucide-react';
import { getBusETA, getDistanceMeters } from '../lib/eta';

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

// Dedicated controller for flying to target (e.g. user location)
function MapPanController({ panTarget }) {
  const map = useMap();
  useEffect(() => {
    if (panTarget && panTarget.lat && panTarget.lng) {
      map.flyTo([panTarget.lat, panTarget.lng], panTarget.zoom || 16, {
        animate: true,
        duration: 1.2
      });
    }
  }, [panTarget, map]);
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

// Create custom DivIcon for Stops with optional Next-Stop highlight
function createStopIcon(seq, isNext = false) {
  return L.divIcon({
    className: 'custom-stop-marker',
    iconSize: isNext ? [30, 30] : [26, 26],
    iconAnchor: isNext ? [15, 15] : [13, 13],
    popupAnchor: [0, -13],
    html: `
      <div class="stop-marker-pin ${isNext ? 'next-stop-pin' : ''}" style="width: ${isNext ? '30px' : '26px'}; height: ${isNext ? '30px' : '26px'};">
        ${seq || '•'}
      </div>
    `
  });
}

// Create custom DivIcon for User Current Location
function createUserIcon() {
  return L.divIcon({
    className: 'custom-user-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
    html: `
      <div class="user-marker-container">
        <div class="user-marker-pulse"></div>
        <div class="user-marker-dot"></div>
      </div>
    `
  });
}

const DEFAULT_CENTER = [12.020898, 79.855204]; // Pondicherry University (PU) Campus Coordinates

export default function MapView({ buses = [], stops = [], selectedBus, onSelectBus }) {
  // User geolocation state
  const [userLocation, setUserLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [panTarget, setPanTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const watchIdRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((message) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  // Filter out offline buses from the map for a cleaner look
  const visibleBuses = buses.filter(
    (bus) => bus.status && bus.status.toUpperCase() !== 'OFFLINE' && bus.location?.lat && bus.location?.lng
  );

  const isSelectedActive = Boolean(
    selectedBus &&
    selectedBus.status &&
    selectedBus.status.toUpperCase() !== 'OFFLINE' &&
    selectedBus.location?.lat &&
    selectedBus.location?.lng
  );
  const targetBus = isSelectedActive ? selectedBus : (visibleBuses[0] || null);

  // Determine initial center from selected active bus, first visible bus, first stop, or campus center
  const mapCenter = targetBus?.location?.lat && targetBus?.location?.lng
    ? [targetBus.location.lat, targetBus.location.lng]
    : (stops && stops.length > 0 && stops[0].lat && stops[0].lng
        ? [stops[0].lat, stops[0].lng]
        : DEFAULT_CENTER);

  // Compute selected bus ETA for stop markers only if selected bus is active
  const selectedEta = isSelectedActive ? getBusETA(selectedBus, stops) : null;

  // Extract stops polyline coordinates if stops exist
  const stopCoordinates = stops && stops.length > 0
    ? stops.map((s) => [s.lat, s.lng])
    : [];

  // Locate User handler
  const handleLocateMe = useCallback(() => {
    if (!('geolocation' in navigator)) {
      showToast('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy, heading } = position.coords;
        const newLocation = {
          lat: latitude,
          lng: longitude,
          accuracy: accuracy || 20,
          heading: heading || 0
        };

        setUserLocation(newLocation);
        setIsLocating(false);
        setIsTracking(true);

        // Smoothly fly to user location
        setPanTarget({
          lat: latitude,
          lng: longitude,
          zoom: 16,
          timestamp: Date.now()
        });

        showToast('📍 Centered on your current location');

        // Watch continuous movements across campus
        if (watchIdRef.current === null) {
          watchIdRef.current = navigator.geolocation.watchPosition(
            (pos) => {
              setUserLocation({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy || 20,
                heading: pos.coords.heading || 0
              });
            },
            (err) => console.warn('Location watch update error:', err.message),
            { enableHighAccuracy: true, maximumAge: 10000 }
          );
        }
      },
      (error) => {
        setIsLocating(false);
        let errorMsg = 'Could not access your location';
        if (error.code === 1) {
          errorMsg = 'Location permission denied. Please allow GPS access.';
        } else if (error.code === 2) {
          errorMsg = 'GPS location unavailable. Please check device location.';
        } else if (error.code === 3) {
          errorMsg = 'Location request timed out. Please try again.';
        }
        showToast(errorMsg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      }
    );
  }, [showToast]);

  // Clean up watcher on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Compute nearest bus stop from user position
  const nearestStop = useMemo(() => {
    if (!userLocation || !stops || stops.length === 0) return null;
    let minDistance = Infinity;
    let closest = null;

    for (const stop of stops) {
      if (stop.lat && stop.lng) {
        const d = getDistanceMeters(userLocation.lat, userLocation.lng, stop.lat, stop.lng);
        if (d < minDistance) {
          minDistance = d;
          closest = { stop, distance: Math.round(d) };
        }
      }
    }
    return closest;
  }, [userLocation, stops]);

  // Compute distance from user to currently selected bus (if active)
  const distanceToSelectedBus = useMemo(() => {
    if (!userLocation || !selectedBus?.location?.lat || !selectedBus?.location?.lng) return null;
    const d = getDistanceMeters(
      userLocation.lat,
      userLocation.lng,
      selectedBus.location.lat,
      selectedBus.location.lng
    );
    return Math.round(d);
  }, [userLocation, selectedBus]);

  return (
    <div className="map-wrap">
      {/* Toast Feedback */}
      {toast && (
        <div className="map-locate-toast">
          <span>{toast}</span>
        </div>
      )}

      {/* Floating "Locate Me" Action Button */}
      <button
        type="button"
        className={`map-locate-btn ${isLocating ? 'locating' : ''} ${isTracking ? 'active' : ''}`}
        onClick={handleLocateMe}
        title={isTracking ? 'Re-center on my location' : 'Find where I am'}
        aria-label="Find where I am"
      >
        {isLocating ? (
          <Loader2 size={20} className="spin" style={{ color: '#2563eb' }} />
        ) : isTracking ? (
          <LocateFixed size={20} style={{ color: '#2563eb' }} />
        ) : (
          <Locate size={20} />
        )}
      </button>

      <MapContainer
        center={mapCenter}
        zoom={15}
        scrollWheelZoom={false}
        className="map-inner"
      >
        <ChangeMapView center={mapCenter} />
        <MapPanController panTarget={panTarget} />

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
        {stops.map((stop) => {
          const isNextForSelected =
            selectedEta?.nextStop?.id === stop.id ||
            (selectedEta?.nextStop?.seq === stop.seq && selectedEta?.nextStop?.name === stop.name);

          return (
            <Marker
              key={stop.id || `${stop.lat}-${stop.lng}`}
              position={[stop.lat, stop.lng]}
              icon={createStopIcon(stop.seq, isNextForSelected)}
            >
              <Popup>
                <div style={{ padding: '4px', textAlign: 'center', minWidth: 120 }}>
                  <strong style={{ display: 'block', fontSize: '13px', color: '#1e293b' }}>
                    {stop.name}
                  </strong>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Stop #{stop.seq}
                  </span>
                  {isNextForSelected && (
                    <div
                      style={{
                        marginTop: '6px',
                        padding: '3px 8px',
                        backgroundColor: selectedEta.isArriving ? '#ecfdf5' : '#eff6ff',
                        color: selectedEta.isArriving ? '#065f46' : '#1e40af',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        border: `1px solid ${selectedEta.isArriving ? '#a7f3d0' : '#bfdbfe'}`
                      }}
                    >
                      Next arrival: {selectedEta.etaText}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Visible Bus Markers */}
        {visibleBuses.map((bus) => {
          if (!bus.location?.lat || !bus.location?.lng) return null;
          const pos = [bus.location.lat, bus.location.lng];
          const icon = createBusIcon(bus.status, bus.location.heading);
          const etaInfo = getBusETA(bus, stops);

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
                <div style={{ minWidth: 150, padding: 4 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 4
                    }}
                  >
                    <strong style={{ fontSize: 13 }}>{bus.plate_no}</strong>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: bus.status === 'LIVE' ? '#2563eb' : '#f59e0b'
                      }}
                    >
                      {bus.status}
                    </span>
                  </div>

                  <div style={{ fontSize: 11, color: '#475569', marginBottom: 2 }}>
                    Route: <strong>{bus.route?.name || 'Campus Shuttle'}</strong>
                  </div>

                  {etaInfo?.nextStop && (
                    <div
                      style={{
                        marginTop: 4,
                        marginBottom: 4,
                        padding: '4px 6px',
                        background: etaInfo.isArriving ? '#ecfdf5' : '#eff6ff',
                        borderRadius: 4,
                        fontSize: 11,
                        border: `1px solid ${
                          etaInfo.isArriving ? '#a7f3d0' : '#bfdbfe'
                        }`
                      }}
                    >
                      <div style={{ color: '#1e293b', fontWeight: 600 }}>
                        Next: {etaInfo.nextStop.name}
                      </div>
                      <div
                        style={{
                          color: etaInfo.isArriving ? '#059669' : '#2563eb',
                          fontWeight: 700,
                          fontSize: 10
                        }}
                      >
                        ETA: {etaInfo.etaText} ({etaInfo.distanceText})
                      </div>
                    </div>
                  )}

                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    Speed: {bus.location.speed_kmh} km/h
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* User Current Location Marker & Accuracy Halo */}
        {userLocation && (
          <>
            <Circle
              center={[userLocation.lat, userLocation.lng]}
              radius={Math.min(userLocation.accuracy || 25, 150)}
              pathOptions={{
                color: '#2563eb',
                fillColor: '#3b82f6',
                fillOpacity: 0.15,
                weight: 1.5,
                opacity: 0.5
              }}
            />
            <Marker
              position={[userLocation.lat, userLocation.lng]}
              icon={createUserIcon()}
              zIndexOffset={1000}
            >
              <Popup>
                <div style={{ padding: '6px', minWidth: 150 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '15px' }}>📍</span>
                    <strong style={{ fontSize: '13px', color: '#1e293b' }}>You are here</strong>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>
                    Accuracy: ±{Math.round(userLocation.accuracy)}m
                  </div>

                  {nearestStop && (
                    <div
                      style={{
                        marginTop: '4px',
                        padding: '4px 6px',
                        background: '#f1f5f9',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#334155'
                      }}
                    >
                      Nearest Stop: <strong>{nearestStop.stop.name}</strong> ({nearestStop.distance}m)
                    </div>
                  )}

                  {distanceToSelectedBus !== null && (
                    <div
                      style={{
                        marginTop: '4px',
                        padding: '4px 6px',
                        background: '#eff6ff',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#1e40af',
                        fontWeight: 600,
                        border: '1px solid #bfdbfe'
                      }}
                    >
                      {distanceToSelectedBus < 1000
                        ? `${distanceToSelectedBus}m to Bus ${selectedBus.plate_no}`
                        : `${(distanceToSelectedBus / 1000).toFixed(1)}km to Bus ${selectedBus.plate_no}`}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          </>
        )}
      </MapContainer>
    </div>
  );
}

