import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Locate, LocateFixed, Loader2, Navigation2 } from 'lucide-react';
import { getBusETA, getDistanceMeters, findNearestStop } from '../lib/eta';

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

// Dedicated controller for flying to target (e.g. user location or nearest stop)
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

// Allows user to click anywhere on map to set their current spot
function MapClickHandler({ onSelectLocation }) {
  useMapEvents({
    click(e) {
      if (e?.latlng?.lat && e?.latlng?.lng) {
        onSelectLocation({
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          accuracy: 10,
          source: 'manual',
          name: 'Custom Map Pin'
        });
      }
    }
  });
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

// Create custom DivIcon for Stops with Next-Stop or Nearest-Stop highlight
function createStopIcon(seq, isNext = false, isNearest = false) {
  let extraClass = '';
  if (isNearest) {
    extraClass = 'nearest-stop-pin';
  } else if (isNext) {
    extraClass = 'next-stop-pin';
  }

  const size = (isNearest || isNext) ? [32, 32] : [26, 26];
  const anchor = (isNearest || isNext) ? [16, 16] : [13, 13];

  return L.divIcon({
    className: 'custom-stop-marker',
    iconSize: size,
    iconAnchor: anchor,
    popupAnchor: [0, -anchor[1]],
    html: `
      <div class="stop-marker-pin ${extraClass}" style="width: ${size[0]}px; height: ${size[1]}px;">
        ${isNearest ? '★' : (seq || '•')}
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

export default function MapView({
  buses = [],
  stops = [],
  selectedBus,
  onSelectBus,
  userLocation: externalUserLocation,
  onUserLocationChange,
  nearestStop: externalNearestStop,
  focusTarget
}) {
  // User location state (internal fallback if not controlled by parent)
  const [internalUserLocation, setInternalUserLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [panTarget, setPanTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const watchIdRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  const currentUserLocation = externalUserLocation !== undefined ? externalUserLocation : internalUserLocation;

  const showToast = useCallback((message) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3800);
  }, []);

  const setUserLocationUnified = useCallback((newLoc) => {
    if (externalUserLocation === undefined) {
      setInternalUserLocation(newLoc);
    }
    onUserLocationChange?.(newLoc);
  }, [externalUserLocation, onUserLocationChange]);

  // Handle external focus target changes (e.g. clicking "Show on Map" on nearest stop card)
  useEffect(() => {
    if (focusTarget && focusTarget.lat && focusTarget.lng) {
      setPanTarget(focusTarget);
    }
  }, [focusTarget]);

  // Compute nearest bus stop if not supplied by parent
  const computedNearestStop = useMemo(() => {
    if (!currentUserLocation || !stops || stops.length === 0) return null;
    return findNearestStop(currentUserLocation, stops);
  }, [currentUserLocation, stops]);

  const currentNearestStop = externalNearestStop !== undefined ? externalNearestStop : computedNearestStop;

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

  // Determine initial center
  const mapCenter = targetBus?.location?.lat && targetBus?.location?.lng
    ? [targetBus.location.lat, targetBus.location.lng]
    : (stops && stops.length > 0 && stops[0].lat && stops[0].lng
        ? [stops[0].lat, stops[0].lng]
        : DEFAULT_CENTER);

  // Compute selected bus ETA for stop markers
  const selectedEta = isSelectedActive ? getBusETA(selectedBus, stops) : null;

  // Extract stops polyline coordinates
  const stopCoordinates = stops && stops.length > 0
    ? stops.map((s) => [s.lat, s.lng])
    : [];

  // Multi-tier GPS Locate Handler (satellite GPS -> network IP fallback)
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      showToast('GPS unavailable. Click anywhere on the map or pick a campus spot below.');
      return;
    }

    setIsLocating(true);

    const handleSuccess = (position) => {
      const { latitude, longitude, accuracy, heading } = position.coords;
      const newLocation = {
        lat: latitude,
        lng: longitude,
        accuracy: accuracy || 15,
        heading: heading || 0,
        source: 'gps',
        name: 'My GPS Location'
      };

      setUserLocationUnified(newLocation);
      setIsLocating(false);
      setIsTracking(true);

      setPanTarget({
        lat: latitude,
        lng: longitude,
        zoom: 16,
        timestamp: Date.now()
      });

      showToast('📍 Centered on your live GPS position');

      // Continuous watcher
      if (watchIdRef.current === null) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            setUserLocationUnified({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy || 15,
              heading: pos.coords.heading || 0,
              source: 'gps',
              name: 'My GPS Location'
            });
          },
          (err) => console.warn('Location watch update notice:', err.message),
          { enableHighAccuracy: false, maximumAge: 10000 }
        );
      }
    };

    const handleNetworkFallback = () => {
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        (finalErr) => {
          setIsLocating(false);
          let errorMsg = 'GPS unavailable. Tap map or choose a landmark!';
          if (finalErr.code === 1) {
            errorMsg = 'Location permission denied. Tap anywhere on map to set spot!';
          }
          showToast(errorMsg);
        },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 30000 }
      );
    };

    // Try high accuracy GPS first with 4.5s timeout
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (firstErr) => {
        if (firstErr.code === 1) {
          setIsLocating(false);
          showToast('Location permission denied. Tap map to set your location!');
        } else {
          // Hardware GPS timed out or unavailable on PC -> retry with WiFi/cellular location
          handleNetworkFallback();
        }
      },
      { enableHighAccuracy: true, timeout: 4500, maximumAge: 5000 }
    );
  }, [showToast, setUserLocationUnified]);

  // Click on map to set custom user location
  const handleMapLocationSelect = useCallback((point) => {
    setUserLocationUnified(point);
    setIsTracking(false);
    showToast('📍 Location pinned! Nearest stop updated.');
  }, [setUserLocationUnified, showToast]);

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

  // Compute distance from user to selected bus
  const distanceToSelectedBus = useMemo(() => {
    if (!currentUserLocation || !selectedBus?.location?.lat || !selectedBus?.location?.lng) return null;
    const d = getDistanceMeters(
      currentUserLocation.lat,
      currentUserLocation.lng,
      selectedBus.location.lat,
      selectedBus.location.lng
    );
    return Math.round(d);
  }, [currentUserLocation, selectedBus]);

  return (
    <div className="map-wrap">
      {/* Interactive Helper Hint */}
      <div className="map-crosshair-hint">
        <span>💡 Tap anywhere on map to set location</span>
      </div>

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
        title={isTracking ? 'Re-center on my GPS' : 'Find where I am'}
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
        <MapClickHandler onSelectLocation={handleMapLocationSelect} />

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

        {/* Green Dotted Walking Path from User to Nearest Stop */}
        {currentUserLocation && currentNearestStop?.lat && currentNearestStop?.lng && (
          <Polyline
            positions={[
              [currentUserLocation.lat, currentUserLocation.lng],
              [currentNearestStop.lat, currentNearestStop.lng]
            ]}
            pathOptions={{
              color: '#10b981',
              weight: 3.5,
              opacity: 0.9,
              dashArray: '5, 7'
            }}
          />
        )}

        {/* Bus Stop Markers */}
        {stops.map((stop) => {
          const isNearest = currentNearestStop?.id === stop.id ||
            (currentNearestStop?.seq === stop.seq && currentNearestStop?.name === stop.name);

          const isNextForSelected =
            selectedEta?.nextStop?.id === stop.id ||
            (selectedEta?.nextStop?.seq === stop.seq && selectedEta?.nextStop?.name === stop.name);

          return (
            <Marker
              key={stop.id || `${stop.lat}-${stop.lng}`}
              position={[stop.lat, stop.lng]}
              icon={createStopIcon(stop.seq, isNextForSelected, isNearest)}
              zIndexOffset={isNearest ? 500 : 10}
            >
              <Popup>
                <div style={{ padding: '4px', textAlign: 'center', minWidth: 140 }}>
                  <strong style={{ display: 'block', fontSize: '13px', color: '#1e293b' }}>
                    {stop.name}
                  </strong>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Stop #{stop.seq}
                  </span>

                  {isNearest && (
                    <div
                      style={{
                        marginTop: '6px',
                        padding: '3px 8px',
                        backgroundColor: '#ecfdf5',
                        color: '#065f46',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        border: '1px solid #a7f3d0'
                      }}
                    >
                      ★ Nearest to you ({currentNearestStop.distanceText || `${currentNearestStop.distanceMeters}m`})
                    </div>
                  )}

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
        {currentUserLocation && (
          <>
            <Circle
              center={[currentUserLocation.lat, currentUserLocation.lng]}
              radius={Math.min(currentUserLocation.accuracy || 20, 150)}
              pathOptions={{
                color: '#2563eb',
                fillColor: '#3b82f6',
                fillOpacity: 0.15,
                weight: 1.5,
                opacity: 0.5
              }}
            />
            <Marker
              position={[currentUserLocation.lat, currentUserLocation.lng]}
              icon={createUserIcon()}
              zIndexOffset={1000}
            >
              <Popup>
                <div style={{ padding: '6px', minWidth: 150 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '15px' }}>📍</span>
                    <strong style={{ fontSize: '13px', color: '#1e293b' }}>
                      {currentUserLocation.name || 'You are here'}
                    </strong>
                  </div>

                  {currentNearestStop && (
                    <div
                      style={{
                        marginTop: '4px',
                        padding: '5px 8px',
                        background: '#ecfdf5',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#065f46',
                        fontWeight: 600,
                        border: '1px solid #a7f3d0'
                      }}
                    >
                      ★ Nearest Stop: <strong>{currentNearestStop.name}</strong> ({currentNearestStop.distanceText || `${currentNearestStop.distanceMeters}m`})
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


