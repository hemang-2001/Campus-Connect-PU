import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
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
import { getBusETA, getDistanceMeters } from '../lib/eta';

// Default Pondicherry University Campus Center Anchor (Used ONLY for initial map viewport when GPS is loading)
const PONDICHERRY_CAMPUS_CENTER = [12.0235, 79.8535];

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

  // 1. Explicit Focus Target (User Location, Nearest Stop, Focus Bus)
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
      if (e.originalEvent) {
        onUserMapInteraction?.('zoom');
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

// Custom DivIcon for Authentic User GPS Location (High-visibility Pin with Radar Pulse Icon)
function createGpsUserIcon(locationName = 'Live Location') {
  const shortName = locationName && locationName.length > 22
    ? `${locationName.substring(0, 20)}...`
    : (locationName || 'Live Location');

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
          <div class="user-marker-radar-outer"></div>
          <div class="user-marker-pin-head">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/>
              <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/>
              <circle cx="12" cy="12" r="2" fill="currentColor"/>
              <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/>
              <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>
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
  userLocation,
  nearestStop,
  focusTarget: externalFocusTarget,
  gpsStatus,
  onRequestGps
}) {
  const [internalFocusTarget, setInternalFocusTarget] = useState(null);
  const [isFollowingBus, setIsFollowingBus] = useState(false);
  const [followPaused, setFollowPaused] = useState(false);
  const [toast, setToast] = useState(null);
  const [hudMinimized, setHudMinimized] = useState(false);

  const mapInstanceRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  // User location is STRICTLY the user's authentic device GPS (or null if not yet locked)
  const effectiveUserLocation = (userLocation?.lat && userLocation?.lng) ? userLocation : null;

  const isLocatingState = gpsStatus === 'locating';
  const isTrackingState = gpsStatus === 'active' && effectiveUserLocation !== null;

  // Active focus target prioritizes external then internal
  const activeFocusTarget = externalFocusTarget || internalFocusTarget;

  const showToast = useCallback((message) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3200);
  }, []);

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

  // Initial center: if GPS is active center on user, else center on Pondicherry University campus
  const initialMapCenter = useMemo(() => {
    if (effectiveUserLocation?.lat && effectiveUserLocation?.lng) {
      return [effectiveUserLocation.lat, effectiveUserLocation.lng];
    }
    return PONDICHERRY_CAMPUS_CENTER;
  }, []);

  // Selected bus ETA calculation
  const selectedEta = isSelectedActive ? getBusETA(selectedBus, stops) : null;

  // Walking path to nearest stop (displayable when GPS is active & nearest stop is available)
  const isWalkingPathDisplayable = useMemo(() => {
    if (!effectiveUserLocation?.lat || !effectiveUserLocation?.lng || !nearestStop?.lat || !nearestStop?.lng) {
      return false;
    }
    const d = getDistanceMeters(effectiveUserLocation.lat, effectiveUserLocation.lng, nearestStop.lat, nearestStop.lng);
    return d < 50000;
  }, [effectiveUserLocation, nearestStop]);

  // Route Polyline coordinates
  const stopCoordinates = useMemo(() => {
    return stops && stops.length > 0 ? stops.map((s) => [s.lat, s.lng]) : [];
  }, [stops]);

  // Compute distance from user GPS to selected bus
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
    if (!nearestStop?.lat || !nearestStop?.lng) {
      showToast('Nearest stop will appear once GPS is locked');
      return;
    }

    setIsFollowingBus(false);
    setFollowPaused(false);

    setInternalFocusTarget({
      lat: nearestStop.lat,
      lng: nearestStop.lng,
      zoom: 17,
      timestamp: Date.now()
    });

    showToast(`🚏 Nearest Stop: ${nearestStop.name}`);
  }, [nearestStop, showToast]);

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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {effectiveUserLocation ? (
                <>
                  <span className="live-pulse-dot" />
                  <span>Live Location (±{effectiveUserLocation.accuracy || 10}m) • Auto-syncing (5s)</span>
                </>
              ) : isLocatingState ? (
                <span>🛰️ Acquiring device GPS location in background...</span>
              ) : (
                <span>📍 Device GPS auto-updating in background</span>
              )}
            </span>
          </div>
        )}

        {/* Quick Fit Campus Overview Button */}
        <button
          type="button"
          className="map-top-action-btn"
          onClick={handleFitOverview}
          title="Fit campus route & fleet on screen"
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

      {/* 3. Floating User GPS ↔ Nearest Stop Live Status Bridge (Top-Center Floating Badge) */}
      {effectiveUserLocation && nearestStop && (
        <div className="map-user-stop-bridge">
          <div className="bridge-pill" title="Live Location">
            <span className="bridge-dot user-dot live-pulse" />
            <span className="bridge-name">Live Location</span>
          </div>

          <div className="bridge-connector" onClick={handleFocusNearestStop} title="Show walking route to nearest stop">
            <span className="bridge-arrow">┄┄►</span>
            <span className="bridge-walk-tag">
              ~{nearestStop.walkTimeMinutes || 1} min walk ({nearestStop.distanceText || `${nearestStop.distanceMeters}m`})
            </span>
          </div>

          <div className="bridge-pill stop-pill" onClick={handleFocusNearestStop} title="Center on nearest bus stop">
            <span className="bridge-dot stop-dot" />
            <span className="bridge-name">{nearestStop.name}</span>
          </div>
        </div>
      )}

      {/* 4. Floating Right-Side Controls Dock */}
      <div className="map-controls-dock">
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

        {/* Focus Nearest Stop Button (Enabled once GPS calculates nearest stop) */}
        {nearestStop && (
          <button
            type="button"
            className="map-dock-btn stop-btn"
            onClick={handleFocusNearestStop}
            title={`Center on nearest stop: ${nearestStop.name}`}
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
              <div className="hud-metric-row">
                {/* Next Stop & ETA */}
                <div className="hud-metric-card primary">
                  <div className="metric-label">
                    <Clock size={12} /> Next Stop
                  </div>
                  <div className="metric-value">
                    {selectedEta?.nextStop?.name || 'In Transit'}
                  </div>
                  <div className="metric-sub">
                    {selectedEta?.isArriving ? (
                      <span className="arriving-badge">Arriving Now</span>
                    ) : (
                      <span>ETA: {selectedEta?.etaText || '--'}</span>
                    )}
                  </div>
                </div>

                {/* Speed & Distance to User */}
                <div className="hud-metric-card secondary">
                  <div className="metric-label">
                    <Gauge size={12} /> Speed / Dist
                  </div>
                  <div className="metric-value">
                    {targetBus.location?.speed_kmh || 0} km/h
                  </div>
                  <div className="metric-sub">
                    {distanceToSelectedBus !== null ? (
                      <span>
                        {distanceToSelectedBus < 1000
                          ? `${distanceToSelectedBus}m from you`
                          : `${(distanceToSelectedBus / 1000).toFixed(1)}km from you`}
                      </span>
                    ) : (
                      <span>Tracking live</span>
                    )}
                  </div>
                </div>
              </div>

              {/* HUD Action Footer */}
              <div className="hud-actions-row">
                <button
                  type="button"
                  className={`btn-hud-action ${isFollowingBus ? 'active' : ''}`}
                  onClick={handleFocusBus}
                >
                  <Bus size={13} />
                  <span>{isFollowingBus ? 'Following' : 'Center Bus'}</span>
                </button>

                {nearestStop && (
                  <button
                    type="button"
                    className="btn-hud-action"
                    onClick={handleFocusNearestStop}
                  >
                    <MapPin size={13} />
                    <span>Nearest Stop</span>
                  </button>
                )}

                {effectiveUserLocation && (
                  <button
                    type="button"
                    className="btn-hud-action"
                    onClick={handleLocateMe}
                  >
                    <LocateFixed size={13} />
                    <span>My GPS</span>
                  </button>
                )}
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
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Camera Controller handles smooth flying without bouncing/snapping back */}
        <MapCameraController
          focusTarget={activeFocusTarget}
          selectedBusId={targetBus?.id}
          selectedBusLocation={targetBus?.location}
          isFollowingBus={isFollowingBus}
          onUserMapInteraction={handleUserMapInteraction}
          onMapReady={(map) => {
            mapInstanceRef.current = map;
          }}
        />

        {/* Route Polyline (Route Path connecting ordered stops) */}
        {stopCoordinates.length > 1 && (
          <Polyline
            positions={stopCoordinates}
            pathOptions={{
              color: selectedBus?.route?.color || '#2563eb',
              weight: 4.5,
              opacity: 0.75,
              dashArray: '6, 8'
            }}
          />
        )}

        {/* Green Dotted Walking Path from User GPS to Nearest Stop */}
        {isWalkingPathDisplayable && nearestStop && effectiveUserLocation && (
          <Polyline
            positions={[
              [effectiveUserLocation.lat, effectiveUserLocation.lng],
              [nearestStop.lat, nearestStop.lng]
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
          const isNearest = nearestStop?.id === stop.id ||
            (nearestStop?.seq === stop.seq && nearestStop?.name === stop.name);

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
                      ★ Nearest Stop to Your GPS ({nearestStop.distanceText || `${nearestStop.distanceMeters}m`})
                      <div style={{ fontSize: '10px', fontWeight: 600, color: '#047857', marginTop: '2px' }}>
                        ~{nearestStop.walkTimeMinutes || 1} min walk
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

        {/* User Authentic GPS Location Marker (Rendered ONLY when GPS is acquired) */}
        {effectiveUserLocation && (
          <>
            <Circle
              center={[effectiveUserLocation.lat, effectiveUserLocation.lng]}
              radius={Math.min(effectiveUserLocation.accuracy || 15, 100)}
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
              icon={createGpsUserIcon(effectiveUserLocation.name)}
              zIndexOffset={1000}
              draggable={false}
            >
              <Popup>
                <div style={{ padding: '6px', minWidth: 170 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '16px' }}>🛰️</span>
                    <strong style={{ fontSize: '13px', color: '#1e293b' }}>
                      My Device GPS Location
                    </strong>
                  </div>
                  <div style={{ fontSize: '11px', color: '#047857', marginBottom: '4px', fontWeight: 600 }}>
                    Coordinates: {effectiveUserLocation.lat.toFixed(5)}°, {effectiveUserLocation.lng.toFixed(5)}°
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                    Accuracy: ±{effectiveUserLocation.accuracy || 10} meters
                  </div>

                  {nearestStop && (
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
                      ★ Nearest Stop: <strong>{nearestStop.name}</strong>
                      <div style={{ fontSize: '10px', color: '#047857', marginTop: '2px' }}>
                        {nearestStop.distanceText || `${nearestStop.distanceMeters}m`} • ~{nearestStop.walkTimeMinutes || 1} min walk
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
