import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  Locate,
  LocateFixed,
  Loader2,
  Navigation,
  MapPin,
  Maximize2,
  Gauge,
  Clock,
  Compass,
  ChevronDown,
  ChevronUp,
  Bus,
  Footprints,
  Eye,
  Radio,
  Sparkles
} from 'lucide-react';
import { getBusETA, getDistanceMeters, findNearestStop } from '../lib/eta';

// Authentic Pondicherry University Central Campus Location (Default starting anchor)
const DEFAULT_CAMPUS_LOCATION = {
  lat: 12.020898,
  lng: 79.855204, // Central Library / MBA Department
  accuracy: 15,
  heading: 0,
  speed: 0,
  source: 'campus_default',
  name: 'Central Library / MBA (Campus)',
  timestamp: Date.now()
};

// Map Camera Controller: smoothly handles focusing and following without snapping back!
function MapCameraController({
  focusTarget,
  selectedBusId,
  selectedBusLocation,
  isFollowingBus,
  onUserMapInteraction,
  onMapReady
}) {
  const map = useMap();
  const prevBusIdRef = useRef(selectedBusId);
  const prevFocusTargetRef = useRef(null);

  // Expose map instance to parent
  useEffect(() => {
    onMapReady?.(map);
  }, [map, onMapReady]);

  // 1. Explicit Focus Target (User Location, Nearest Stop, Focus Bus, Landmark)
  useEffect(() => {
    if (focusTarget && focusTarget.lat && focusTarget.lng) {
      const isNewTarget =
        !prevFocusTargetRef.current ||
        prevFocusTargetRef.current.timestamp !== focusTarget.timestamp ||
        prevFocusTargetRef.current.lat !== focusTarget.lat ||
        prevFocusTargetRef.current.lng !== focusTarget.lng;

      if (isNewTarget) {
        prevFocusTargetRef.current = focusTarget;
        map.flyTo([focusTarget.lat, focusTarget.lng], focusTarget.zoom || 16, {
          animate: true,
          duration: 1.0
        });
      }
    }
  }, [focusTarget, map]);

  // 2. Bus Selection Switch: when student selects a different shuttle, smoothly fly to it!
  useEffect(() => {
    if (selectedBusId && selectedBusId !== prevBusIdRef.current) {
      prevBusIdRef.current = selectedBusId;
      if (selectedBusLocation?.lat && selectedBusLocation?.lng) {
        map.flyTo([selectedBusLocation.lat, selectedBusLocation.lng], 16, {
          animate: true,
          duration: 1.0
        });
      }
    }
  }, [selectedBusId, selectedBusLocation, map]);

  // 3. Live Follow Mode: keep the active bus centered as it drives, if follow mode is active
  useEffect(() => {
    if (isFollowingBus && selectedBusLocation?.lat && selectedBusLocation?.lng) {
      map.panTo([selectedBusLocation.lat, selectedBusLocation.lng], {
        animate: true,
        duration: 0.8
      });
    }
  }, [isFollowingBus, selectedBusLocation?.lat, selectedBusLocation?.lng, map]);

  // 4. User Interaction Detection: dragging or zooming pauses follow mode so user is in full control!
  useMapEvents({
    dragstart() {
      onUserMapInteraction?.('drag');
    },
    zoomstart(e) {
      // Pause follow if triggered by user gesture (not programmatic flyTo)
      if (e.originalEvent) {
        onUserMapInteraction?.('zoom');
      }
    }
  });

  return null;
}

// Allows user to click anywhere on map to drop a pin
function MapClickHandler({ onSelectLocation }) {
  useMapEvents({
    click(e) {
      if (e?.latlng?.lat && e?.latlng?.lng) {
        onSelectLocation({
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          accuracy: 10,
          source: 'manual',
          name: 'Custom Pinned Spot'
        });
      }
    }
  });
  return null;
}

// Custom DivIcon for Buses
function createBusIcon(status = 'LIVE', heading = 0, isSelected = false) {
  const colorClass = status.toLowerCase(); // 'live' -> blue, 'mock' -> amber, 'offline' -> gray
  const size = isSelected ? [42, 42] : [36, 36];
  const anchor = isSelected ? [21, 21] : [18, 18];

  return L.divIcon({
    className: 'custom-leaflet-marker',
    iconSize: size,
    iconAnchor: anchor,
    popupAnchor: [0, -anchor[1]],
    html: `
      <div class="bus-marker-pin ${colorClass} ${isSelected ? 'selected-bus-marker' : ''}" style="width: ${size[0]}px; height: ${size[1]}px; position: relative;">
        <svg xmlns="http://www.w3.org/2000/svg" width="${isSelected ? 22 : 19}" height="${isSelected ? 22 : 19}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${heading || 0}deg); transition: transform 0.4s ease;">
          <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10z"/>
          <circle cx="7.5" cy="15.5" r="1.5" fill="currentColor"/>
          <circle cx="16.5" cy="15.5" r="1.5" fill="currentColor"/>
          <path d="M4 9h16"/>
        </svg>
        ${isSelected ? '<span class="selected-bus-ping"></span>' : ''}
      </div>
    `
  });
}

// Custom DivIcon for Bus Stops
function createStopIcon(seq, isNext = false, isNearest = false) {
  let extraClass = '';
  if (isNearest) {
    extraClass = 'nearest-stop-pin';
  } else if (isNext) {
    extraClass = 'next-stop-pin';
  }

  const size = (isNearest || isNext) ? [34, 34] : [26, 26];
  const anchor = (isNearest || isNext) ? [17, 17] : [13, 13];

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

// Custom DivIcon for User Current Location (High-visibility Pin with Callout Badge)
function createUserIcon(locationName = 'You are here') {
  const shortName = locationName && locationName.length > 20
    ? `${locationName.substring(0, 18)}...`
    : (locationName || 'You are here');

  return L.divIcon({
    className: 'custom-user-marker',
    iconSize: [120, 56],
    iconAnchor: [60, 52],
    popupAnchor: [0, -52],
    html: `
      <div class="user-marker-pin-wrap">
        <div class="user-marker-callout">
          <span class="user-marker-callout-dot"></span>
          <span>${shortName}</span>
        </div>
        <div class="user-marker-body">
          <div class="user-marker-radar"></div>
          <div class="user-marker-pin-head">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="8" r="4"/>
              <path d="M20 19v-1a7 7 0 0 0-14 0v1"/>
            </svg>
          </div>
        </div>
      </div>
    `
  });
}

export default function MapView({
  buses = [],
  stops = [],
  allStops = [],
  selectedBus,
  onSelectBus,
  userLocation: externalUserLocation,
  onUserLocationChange,
  nearestStop: externalNearestStop,
  focusTarget: externalFocusTarget,
  gpsStatus,
  onRequestGps
}) {
  // Internal fallback state (never null!)
  const [internalUserLocation, setInternalUserLocation] = useState(DEFAULT_CAMPUS_LOCATION);
  const [internalFocusTarget, setInternalFocusTarget] = useState(null);
  const [isFollowingBus, setIsFollowingBus] = useState(false);
  const [followPaused, setFollowPaused] = useState(false);
  const [toast, setToast] = useState(null);
  const [hudMinimized, setHudMinimized] = useState(false);

  const mapInstanceRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  // Effective user location: external prop prioritized, else internal fallback, guaranteed never null!
  const effectiveUserLocation = externalUserLocation || internalUserLocation || DEFAULT_CAMPUS_LOCATION;

  const isLocatingState = gpsStatus ? gpsStatus === 'locating' : false;
  const isTrackingState = gpsStatus ? gpsStatus === 'active' : false;

  // Active focus target prioritizes external then internal
  const activeFocusTarget = externalFocusTarget || internalFocusTarget;

  const showToast = useCallback((message) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3200);
  }, []);

  const setUserLocationUnified = useCallback((newLoc) => {
    setInternalUserLocation(newLoc);
    onUserLocationChange?.(newLoc);
  }, [onUserLocationChange]);

  // Compute nearest bus stop if not supplied by parent (always succeeds since user location is never null!)
  const computedNearestStop = useMemo(() => {
    const stopPool = stops && stops.length > 0 ? stops : (allStops && allStops.length > 0 ? allStops : []);
    if (!effectiveUserLocation || stopPool.length === 0) return null;
    return findNearestStop(effectiveUserLocation, stopPool);
  }, [effectiveUserLocation, stops, allStops]);

  const currentNearestStop = externalNearestStop || computedNearestStop;

  // Filter out offline buses from active map view
  const visibleBuses = useMemo(() => {
    return buses.filter(
      (bus) => bus.status && bus.status.toUpperCase() !== 'OFFLINE' && bus.location?.lat && bus.location?.lng
    );
  }, [buses]);

  const isSelectedActive = Boolean(
    selectedBus &&
    selectedBus.status &&
    selectedBus.status.toUpperCase() !== 'OFFLINE' &&
    selectedBus.location?.lat &&
    selectedBus.location?.lng
  );
  const targetBus = isSelectedActive ? selectedBus : (visibleBuses[0] || null);

  // Initial center: centers on student's location on campus on initial load
  const initialMapCenter = useMemo(() => {
    if (effectiveUserLocation?.lat && effectiveUserLocation?.lng) {
      return [effectiveUserLocation.lat, effectiveUserLocation.lng];
    }
    return [DEFAULT_CAMPUS_LOCATION.lat, DEFAULT_CAMPUS_LOCATION.lng];
  }, []);

  // Selected bus ETA calculation
  const selectedEta = isSelectedActive ? getBusETA(selectedBus, stops) : null;

  // Walking path to nearest stop (within campus distance)
  const isWalkingPathDisplayable = useMemo(() => {
    if (!effectiveUserLocation?.lat || !effectiveUserLocation?.lng || !currentNearestStop?.lat || !currentNearestStop?.lng) {
      return false;
    }
    const d = getDistanceMeters(effectiveUserLocation.lat, effectiveUserLocation.lng, currentNearestStop.lat, currentNearestStop.lng);
    return d < 50000;
  }, [effectiveUserLocation, currentNearestStop]);

  // Route Polyline coordinates
  const stopCoordinates = useMemo(() => {
    return stops && stops.length > 0 ? stops.map((s) => [s.lat, s.lng]) : [];
  }, [stops]);

  // Compute distance from user to selected bus
  const distanceToSelectedBus = useMemo(() => {
    if (!effectiveUserLocation || !targetBus?.location?.lat || !targetBus?.location?.lng) return null;
    const d = getDistanceMeters(
      effectiveUserLocation.lat,
      effectiveUserLocation.lng,
      targetBus.location.lat,
      targetBus.location.lng
    );
    return Math.round(d);
  }, [effectiveUserLocation, targetBus]);

  // When user interacts with the map (drags/zooms), pause follow mode
  const handleUserMapInteraction = useCallback(() => {
    if (isFollowingBus) {
      setIsFollowingBus(false);
      setFollowPaused(true);
      showToast('⏸️ Auto-follow paused • Drag freely');
    }
  }, [isFollowingBus, showToast]);

  // Action: Center on User Location
  const handleLocateMe = useCallback(() => {
    setIsFollowingBus(false);
    setFollowPaused(false);

    if (onRequestGps) {
      onRequestGps();
    }

    if (effectiveUserLocation?.lat && effectiveUserLocation?.lng) {
      setInternalFocusTarget({
        lat: effectiveUserLocation.lat,
        lng: effectiveUserLocation.lng,
        zoom: 16,
        timestamp: Date.now()
      });
      showToast('📍 Centered on your location');
    } else {
      showToast('📡 Acquiring device location...');
    }
  }, [effectiveUserLocation, onRequestGps, showToast]);

  // Action: Focus / Follow Selected Bus
  const handleFocusBus = useCallback(() => {
    if (!targetBus?.location?.lat || !targetBus?.location?.lng) {
      showToast('Bus location unavailable right now');
      return;
    }

    setInternalFocusTarget({
      lat: targetBus.location.lat,
      lng: targetBus.location.lng,
      zoom: 16,
      timestamp: Date.now()
    });

    setIsFollowingBus(true);
    setFollowPaused(false);
    showToast(`🚌 Following Bus ${targetBus.plate_no}`);
  }, [targetBus, showToast]);

  // Action: Resume Auto-Follow
  const handleResumeFollow = useCallback(() => {
    if (targetBus?.location?.lat && targetBus?.location?.lng) {
      setInternalFocusTarget({
        lat: targetBus.location.lat,
        lng: targetBus.location.lng,
        zoom: 16,
        timestamp: Date.now()
      });
      setIsFollowingBus(true);
      setFollowPaused(false);
      showToast(`🟢 Resumed tracking Bus ${targetBus.plate_no}`);
    }
  }, [targetBus, showToast]);

  // Action: Focus Nearest Stop
  const handleFocusNearestStop = useCallback(() => {
    if (!currentNearestStop?.lat || !currentNearestStop?.lng) {
      showToast('No nearest stop identified yet');
      return;
    }

    setIsFollowingBus(false);
    setFollowPaused(false);

    setInternalFocusTarget({
      lat: currentNearestStop.lat,
      lng: currentNearestStop.lng,
      zoom: 17,
      timestamp: Date.now()
    });

    showToast(`🚏 Nearest Stop: ${currentNearestStop.name}`);
  }, [currentNearestStop, showToast]);

  // Action: Fit Entire Campus / Route Overview
  const handleFitOverview = useCallback(() => {
    if (!mapInstanceRef.current) return;

    setIsFollowingBus(false);
    setFollowPaused(false);

    const points = [];
    if (effectiveUserLocation?.lat && effectiveUserLocation?.lng) {
      points.push([effectiveUserLocation.lat, effectiveUserLocation.lng]);
    }
    stops.forEach((s) => {
      if (s.lat && s.lng) points.push([s.lat, s.lng]);
    });
    visibleBuses.forEach((b) => {
      if (b.location?.lat && b.location?.lng) points.push([b.location.lat, b.location.lng]);
    });

    if (points.length > 0) {
      try {
        const bounds = L.latLngBounds(points);
        mapInstanceRef.current.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 16,
          animate: true
        });
        showToast('🗺️ Showing campus fleet overview');
      } catch (e) {
        console.warn('fitBounds error:', e);
      }
    } else {
      showToast('Showing campus map');
    }
  }, [effectiveUserLocation, stops, visibleBuses, showToast]);

  // Handle map click location pin
  const handleMapLocationSelect = useCallback((point) => {
    setIsFollowingBus(false);
    setFollowPaused(false);
    setUserLocationUnified(point);
    showToast('📍 Pin moved! Nearest stop & walking time updated.');
  }, [setUserLocationUnified, showToast]);

  // Handle user marker dragging (interactive relocate!)
  const handleMarkerDragEnd = useCallback((lat, lng) => {
    const updated = {
      lat,
      lng,
      accuracy: 10,
      source: 'manual',
      name: 'Custom Location Pin',
      timestamp: Date.now()
    };
    setUserLocationUnified(updated);
    showToast('📍 Location updated! Nearest stop recalculated.');
  }, [setUserLocationUnified, showToast]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  return (
    <div className="map-wrap">
      {/* 1. Top Helper & Follow Status Bar */}
      <div className="map-header-status-bar">
        {isFollowingBus ? (
          <div className="map-follow-chip active" onClick={() => setIsFollowingBus(false)}>
            <span className="pulse-dot live" />
            <span>Following {targetBus?.plate_no}</span>
            <span className="map-chip-action">(Tap to pause)</span>
          </div>
        ) : followPaused ? (
          <button type="button" className="map-follow-chip paused" onClick={handleResumeFollow}>
            <span>⏸️ Auto-Follow Paused</span>
            <span className="map-chip-action">Resume</span>
          </button>
        ) : (
          <div className="map-crosshair-hint">
            <span>💡 Drag your blue pin or tap map to change spot</span>
          </div>
        )}

        {/* Quick Fit Campus Overview Button */}
        <button
          type="button"
          className="map-top-action-btn"
          onClick={handleFitOverview}
          title="Fit entire campus route & fleet on screen"
          aria-label="Campus Overview"
        >
          <Maximize2 size={15} />
          <span>Overview</span>
        </button>
      </div>

      {/* 2. Floating Toast Feedback */}
      {toast && (
        <div className="map-locate-toast">
          <span>{toast}</span>
        </div>
      )}

      {/* 3. Floating User ↔ Nearest Stop Live Status Bridge (Top-Center Floating Badge) */}
      {currentNearestStop && (
        <div className="map-user-stop-bridge">
          <div className="bridge-pill" onClick={handleLocateMe} title="Center on your location">
            <span className="bridge-dot user-dot" />
            <span className="bridge-name">{effectiveUserLocation?.name || 'You'}</span>
          </div>

          <div className="bridge-connector" onClick={handleFocusNearestStop} title="Show walking route">
            <span className="bridge-arrow">┄┄►</span>
            <span className="bridge-walk-tag">
              ~{currentNearestStop.walkTimeMinutes || 2} min walk ({currentNearestStop.distanceText || `${currentNearestStop.distanceMeters}m`})
            </span>
          </div>

          <div className="bridge-pill stop-pill" onClick={handleFocusNearestStop} title="Center on nearest stop">
            <span className="bridge-dot stop-dot" />
            <span className="bridge-name">{currentNearestStop.name}</span>
          </div>
        </div>
      )}

      {/* 4. Floating Right-Side Controls Dock */}
      <div className="map-controls-dock">
        {/* Locate Me (User) Button */}
        <button
          type="button"
          className={`map-dock-btn ${isLocatingState ? 'locating' : ''} ${isTrackingState ? 'active' : ''}`}
          onClick={handleLocateMe}
          title="Center on my location"
          aria-label="Center on my location"
        >
          {isLocatingState ? (
            <Loader2 size={19} className="spin" style={{ color: '#2563eb' }} />
          ) : isTrackingState ? (
            <LocateFixed size={19} style={{ color: '#2563eb' }} />
          ) : (
            <Locate size={19} />
          )}
          <span className="dock-btn-label">Me</span>
        </button>

        {/* Focus Active Bus Button */}
        <button
          type="button"
          className={`map-dock-btn ${isFollowingBus ? 'active' : ''}`}
          onClick={handleFocusBus}
          title={isFollowingBus ? 'Following active shuttle' : 'Center on selected shuttle'}
          aria-label="Center on shuttle"
        >
          <Bus size={19} style={{ color: isFollowingBus ? '#2563eb' : 'inherit' }} />
          <span className="dock-btn-label">Bus</span>
        </button>

        {/* Focus Nearest Stop Button */}
        {currentNearestStop && (
          <button
            type="button"
            className="map-dock-btn stop-btn"
            onClick={handleFocusNearestStop}
            title={`Center on nearest stop: ${currentNearestStop.name}`}
            aria-label="Center on nearest stop"
          >
            <MapPin size={19} style={{ color: '#059669' }} />
            <span className="dock-btn-label">Stop</span>
          </button>
        )}
      </div>

      {/* 5. Floating Live Trip HUD Card (Bottom-Left) */}
      {targetBus && (
        <div className={`map-live-hud ${hudMinimized ? 'minimized' : ''}`}>
          <div className="map-hud-header" onClick={() => setHudMinimized((prev) => !prev)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: targetBus.status === 'LIVE' ? '#10b981' : '#f59e0b',
                  flexShrink: 0
                }}
              />
              <span className="hud-bus-plate">{targetBus.plate_no}</span>
              <span className="hud-route-tag">{targetBus.route?.name || 'Campus Loop'}</span>
            </div>

            <button
              type="button"
              className="hud-toggle-btn"
              aria-label={hudMinimized ? 'Expand shuttle details' : 'Minimize shuttle details'}
            >
              {hudMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {!hudMinimized && (
            <div className="map-hud-body">
              {/* Next Stop & ETA readout */}
              {selectedEta?.nextStop ? (
                <div className={`hud-next-stop-row ${selectedEta.isArriving ? 'arriving' : ''}`}>
                  <div className="hud-stop-name-wrap">
                    <span className="hud-meta-label">NEXT STOP</span>
                    <strong className="hud-stop-name">{selectedEta.nextStop.name}</strong>
                  </div>
                  <div className="hud-eta-badge">
                    <Clock size={12} />
                    <span>{selectedEta.isArriving ? 'Arriving Now' : selectedEta.etaText}</span>
                  </div>
                </div>
              ) : (
                <div className="hud-next-stop-row">
                  <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    {targetBus.status === 'OFFLINE' ? 'Shuttle is currently offline' : 'Active on Campus Loop'}
                  </span>
                </div>
              )}

              {/* Distance from Student & Speed */}
              <div className="hud-stats-row">
                {distanceToSelectedBus !== null && (
                  <div className="hud-stat-item">
                    <Footprints size={13} style={{ color: '#2563eb' }} />
                    <span>
                      {distanceToSelectedBus < 1000
                        ? `${distanceToSelectedBus}m from you`
                        : `${(distanceToSelectedBus / 1000).toFixed(1)}km from you`}
                    </span>
                  </div>
                )}

                <div className="hud-stat-item">
                  <Gauge size={13} style={{ color: '#475569' }} />
                  <span>{targetBus.location?.speed_kmh || 0} km/h</span>
                </div>

                <div className="hud-stat-item" style={{ marginLeft: 'auto' }}>
                  <button
                    type="button"
                    className={`btn-hud-follow ${isFollowingBus ? 'active' : ''}`}
                    onClick={isFollowingBus ? () => setIsFollowingBus(false) : handleFocusBus}
                  >
                    {isFollowingBus ? '✓ Following' : 'Track Bus'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. Leaflet Map Container */}
      <MapContainer
        center={initialMapCenter}
        zoom={15}
        scrollWheelZoom={true}
        className="map-inner"
      >
        <MapCameraController
          focusTarget={activeFocusTarget}
          selectedBusId={selectedBus?.id}
          selectedBusLocation={targetBus?.location}
          isFollowingBus={isFollowingBus}
          onUserMapInteraction={handleUserMapInteraction}
          onMapReady={(m) => {
            mapInstanceRef.current = m;
          }}
        />

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
              weight: 4.5,
              opacity: 0.75,
              dashArray: '6, 8'
            }}
          />
        )}

        {/* Green Dotted Walking Path from User to Nearest Stop */}
        {isWalkingPathDisplayable && currentNearestStop && effectiveUserLocation && (
          <Polyline
            positions={[
              [effectiveUserLocation.lat, effectiveUserLocation.lng],
              [currentNearestStop.lat, currentNearestStop.lng]
            ]}
            pathOptions={{
              color: '#10b981',
              weight: 4,
              opacity: 0.95,
              dashArray: '6, 8'
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
                <div style={{ padding: '4px', textAlign: 'center', minWidth: 160 }}>
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
                        padding: '4px 8px',
                        backgroundColor: '#ecfdf5',
                        color: '#065f46',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        border: '1px solid #a7f3d0'
                      }}
                    >
                      ★ Nearest Stop ({currentNearestStop.distanceText || `${currentNearestStop.distanceMeters}m`})
                      <div style={{ fontSize: '10px', fontWeight: 600, color: '#047857', marginTop: '2px' }}>
                        ~{currentNearestStop.walkTimeMinutes || 2} min walk
                      </div>
                    </div>
                  )}

                  {isNextForSelected && (
                    <div
                      style={{
                        marginTop: '6px',
                        padding: '4px 8px',
                        backgroundColor: selectedEta.isArriving ? '#ecfdf5' : '#eff6ff',
                        color: selectedEta.isArriving ? '#065f46' : '#1e40af',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        border: `1px solid ${selectedEta.isArriving ? '#a7f3d0' : '#bfdbfe'}`
                      }}
                    >
                      {selectedEta.isArriving ? 'Arriving Now!' : `ETA: ${selectedEta.etaText} (${selectedEta.distanceText})`}
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
          const isSelected = bus.id === targetBus?.id;
          const icon = createBusIcon(bus.status, bus.location.heading, isSelected);
          const etaInfo = getBusETA(bus, stops);

          return (
            <Marker
              key={bus.id}
              position={pos}
              icon={icon}
              zIndexOffset={isSelected ? 600 : 200}
              eventHandlers={{
                click: () => {
                  onSelectBus?.(bus);
                  setIsFollowingBus(true);
                  setFollowPaused(false);
                }
              }}
            >
              <Popup>
                <div style={{ minWidth: 160, padding: 4 }}>
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
                    Route: <strong>{bus.route?.name || 'Campus Loop'}</strong>
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

                  <button
                    type="button"
                    style={{
                      marginTop: 6,
                      width: '100%',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      onSelectBus?.(bus);
                      setIsFollowingBus(true);
                      setFollowPaused(false);
                    }}
                  >
                    Track This Shuttle
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* User Current Location Marker (Draggable, High Visibility, NEVER MISSING!) */}
        {effectiveUserLocation && (
          <>
            <Circle
              center={[effectiveUserLocation.lat, effectiveUserLocation.lng]}
              radius={Math.min(effectiveUserLocation.accuracy || 20, 150)}
              pathOptions={{
                color: '#2563eb',
                fillColor: '#3b82f6',
                fillOpacity: 0.15,
                weight: 1.5,
                opacity: 0.5
              }}
            />
            <Marker
              position={[effectiveUserLocation.lat, effectiveUserLocation.lng]}
              icon={createUserIcon(effectiveUserLocation.name)}
              zIndexOffset={1000}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const latlng = e.target.getLatLng();
                  handleMarkerDragEnd(latlng.lat, latlng.lng);
                }
              }}
            >
              <Popup>
                <div style={{ padding: '6px', minWidth: 170 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '16px' }}>📍</span>
                    <strong style={{ fontSize: '13px', color: '#1e293b' }}>
                      {effectiveUserLocation.name || 'You are here'}
                    </strong>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                    💡 Tip: You can drag this pin anywhere on campus!
                  </div>

                  {currentNearestStop && (
                    <div
                      style={{
                        marginTop: '4px',
                        padding: '6px 8px',
                        background: '#ecfdf5',
                        borderRadius: '4px',
                        fontSize: '11px',
                        color: '#065f46',
                        fontWeight: 600,
                        border: '1px solid #a7f3d0'
                      }}
                    >
                      ★ Nearest Stop: <strong>{currentNearestStop.name}</strong>
                      <div style={{ fontSize: '10px', color: '#047857', marginTop: '2px' }}>
                        {currentNearestStop.distanceText || `${currentNearestStop.distanceMeters}m`} • ~{currentNearestStop.walkTimeMinutes || 2} min walk
                      </div>
                    </div>
                  )}

                  {distanceToSelectedBus !== null && targetBus && (
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
                        ? `${distanceToSelectedBus}m to Bus ${targetBus.plate_no}`
                        : `${(distanceToSelectedBus / 1000).toFixed(1)}km to Bus ${targetBus.plate_no}`}
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
