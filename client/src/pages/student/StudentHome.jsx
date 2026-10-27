import React, { useState, useEffect, useMemo, useRef } from 'react';
import MapView from '../../components/MapView';
import BusCard from '../../components/BusCard';
import Loader from '../../components/Loader';
import ErrorState from '../../components/ErrorState';
import { useBusLocations, FALLBACK_STOPS } from '../../hooks/useBusLocations';
import { useUserLocation } from '../../hooks/useUserLocation';
import { supabase } from '../../lib/supabaseClient';
import { getBusETA, findNearestStop, getClosestBusToStop, getDistanceMeters } from '../../lib/eta';
import {
  Navigation,
  MapPin,
  Clock,
  Bus,
  AlertTriangle,
  Loader2,
  Footprints,
  Search,
  Radio
} from 'lucide-react';

export default function StudentHome() {
  const {
    buses,
    allStops,
    loading,
    error,
    refresh,
    selectedBusId,
    setSelectedBusId,
    selectedBus,
    getStopsForBus
  } = useBusLocations();

  // Authentic device GPS telemetry hook (strictly device GPS only!)
  const {
    userLocation,
    gpsStatus,
    gpsError,
    accuracyMeters,
    requestLocation
  } = useUserLocation();

  const [stops, setStops] = useState([]);
  const [loadingStops, setLoadingStops] = useState(false);
  const [focusTarget, setFocusTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const hasAutoCenteredRef = useRef(false);

  // When selected bus changes, load its route's stops
  useEffect(() => {
    async function loadStops() {
      if (!selectedBus?.route?.id) {
        setStops(FALLBACK_STOPS.default);
        return;
      }

      try {
        setLoadingStops(true);
        const { data, error: stopErr } = await supabase
          .from('bus_stops')
          .select('*')
          .eq('route_id', selectedBus.route.id)
          .order('seq', { ascending: true });

        if (stopErr || !data || data.length === 0) {
          const isHostel = selectedBus.route.name?.toLowerCase().includes('hostel');
          setStops(isHostel ? FALLBACK_STOPS.hostel : FALLBACK_STOPS.default);
        } else {
          setStops(data);
        }
      } catch (err) {
        console.warn('Error loading stops:', err);
        setStops(FALLBACK_STOPS.default);
      } finally {
        setLoadingStops(false);
      }
    }

    loadStops();
  }, [selectedBus?.route?.id, selectedBus?.route?.name]);

  // Find nearest stop STRICTLY and exclusively from the user's authentic device GPS location!
  const nearestStop = useMemo(() => {
    if (!userLocation?.lat || !userLocation?.lng || userLocation?.source !== 'gps') {
      return null;
    }
    const pool = allStops && allStops.length > 0 ? allStops : (stops && stops.length > 0 ? stops : FALLBACK_STOPS.default);
    return findNearestStop(userLocation, pool);
  }, [userLocation, allStops, stops]);

  // Find closest approaching bus to the nearest stop
  const closestBusInfo = useMemo(() => {
    return getClosestBusToStop(nearestStop, buses);
  }, [nearestStop, buses]);

  // Automatically center map on user's real GPS fix once when authentic satellites lock in
  useEffect(() => {
    if (userLocation?.lat && userLocation?.lng && !hasAutoCenteredRef.current) {
      hasAutoCenteredRef.current = true;
      setFocusTarget({
        lat: userLocation.lat,
        lng: userLocation.lng,
        zoom: 17,
        timestamp: Date.now()
      });
    }
  }, [userLocation]);


  // Action: Focus on nearest stop
  const handleFocusNearestStop = () => {
    if (nearestStop?.lat && nearestStop?.lng) {
      setFocusTarget({
        lat: nearestStop.lat,
        lng: nearestStop.lng,
        zoom: 17,
        timestamp: Date.now()
      });
    }
  };

  // Action: Select bus from Quick Switcher or card
  const handleSelectBus = (bus) => {
    setSelectedBusId(bus.id);
    if (bus.location?.lat && bus.location?.lng) {
      setFocusTarget({
        lat: bus.location.lat,
        lng: bus.location.lng,
        zoom: 16,
        timestamp: Date.now()
      });
    }
  };

  // Action: Select a stop from the route progress stepper
  const handleSelectStop = (stop) => {
    if (stop?.lat && stop?.lng) {
      setFocusTarget({
        lat: stop.lat,
        lng: stop.lng,
        zoom: 17,
        timestamp: Date.now()
      });
    }
  };

  if (loading) {
    return <Loader message="Locating campus shuttles..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  const liveBuses = buses.filter((b) => b.status === 'LIVE' || b.status === 'MOCK');
  const selectedEta = selectedBus ? getBusETA(selectedBus, stops) : null;

  // Filtered buses for search
  const filteredBuses = buses.filter((bus) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const plate = (bus.plate_no || '').toLowerCase();
    const route = (bus.route?.name || '').toLowerCase();
    return plate.includes(q) || route.includes(q);
  });

  return (
    <div className="student-home-container">
      {/* 1. Top Shuttle Quick-Switcher Bar (Floating / Edge-to-Edge) */}
      <div className="shuttle-quick-switcher">
        <div className="quick-switcher-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Bus size={16} style={{ color: 'var(--blue)' }} />
            <strong style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
              Active Shuttles ({liveBuses.length} Live)
            </strong>
          </div>
          <span className="text-xs text-muted">Tap to track</span>
        </div>

        <div className="quick-switcher-scroll">
          {buses.map((bus) => {
            const isSelected = bus.id === (selectedBus?.id || selectedBusId);
            const busEta = getBusETA(bus, getStopsForBus(bus));
            const isLive = bus.status === 'LIVE';
            const isMock = bus.status === 'MOCK';

            let distanceText = null;
            if (userLocation?.lat && bus.location?.lat) {
              const d = Math.round(getDistanceMeters(userLocation.lat, userLocation.lng, bus.location.lat, bus.location.lng));
              distanceText = d < 1000 ? `${d}m away` : `${(d / 1000).toFixed(1)}km away`;
            }

            return (
              <button
                key={bus.id}
                type="button"
                className={`shuttle-quick-pill ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelectBus(bus)}
              >
                <div className="pill-top-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      className={`pill-status-dot ${isLive ? 'live' : isMock ? 'mock' : 'offline'}`}
                    />
                    <strong className="pill-bus-plate">{bus.plate_no}</strong>
                  </div>

                  {busEta?.etaText && busEta.etaText !== '--' && (
                    <span className="pill-eta-badge">
                      {busEta.isArriving ? 'Arriving' : busEta.etaText}
                    </span>
                  )}
                </div>

                <div className="pill-route-name">
                  {bus.route?.name || 'Campus Shuttle'}
                </div>

                <div className="pill-bottom-row">
                  {busEta?.nextStop && (
                    <span className="pill-next-stop">
                      Next: {busEta.nextStop.name}
                    </span>
                  )}
                  {distanceText && (
                    <span className="pill-distance">
                      {distanceText}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Interactive Map (Strictly Using User GPS Location) */}
      <MapView
        buses={buses}
        stops={stops}
        allStops={allStops}
        selectedBus={selectedBus}
        onSelectBus={handleSelectBus}
        userLocation={userLocation}
        nearestStop={nearestStop}
        focusTarget={focusTarget}
        gpsStatus={gpsStatus}
        onRequestGps={requestLocation}
      />

      {/* 3. Main Controls & Information Container */}
      <div style={{ padding: '16px' }}>

        {/* 4. Nearest Bus Stop Card (STRICTLY FROM USER GPS) */}
        {nearestStop && userLocation ? (
          <div className="card mb-3 nearest-stop-card">
            <div className="flex-between mb-2">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 3px 10px rgba(16, 185, 129, 0.4)',
                    flexShrink: 0
                  }}
                >
                  <MapPin size={24} />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      color: '#047857',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    ★ Nearest Stop to Your GPS Location
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '2px 0' }}>
                    {nearestStop.name}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: nearestStop?.route?.color || '#2563eb'
                      }}
                    />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                      {nearestStop?.route?.name || 'Campus Loop'} • Stop #{nearestStop.seq}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    backgroundColor: '#d1fae5',
                    color: '#065f46',
                    borderRadius: '9999px',
                    fontSize: '0.875rem',
                    fontWeight: 800
                  }}
                >
                  {nearestStop.distanceText || `${nearestStop.distanceMeters}m`}
                </span>
                <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                  <Footprints size={13} />
                  <span>~{nearestStop.walkTimeMinutes || 1} min walk</span>
                </div>
              </div>
            </div>

            {/* Closest Approaching Bus to Nearest Stop */}
            {closestBusInfo ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  marginTop: '10px',
                  fontSize: '0.8125rem',
                  border: '1px solid rgba(16, 185, 129, 0.25)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <Bus size={16} style={{ color: '#2563eb', flexShrink: 0 }} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Approaching: <strong>{closestBusInfo.bus.plate_no}</strong> ({closestBusInfo.bus.route?.name || 'Campus Shuttle'})
                  </span>
                </div>
                <span
                  style={{
                    fontWeight: 800,
                    color: closestBusInfo.isArriving ? '#059669' : '#2563eb',
                    backgroundColor: closestBusInfo.isArriving ? '#ecfdf5' : '#eff6ff',
                    padding: '3px 9px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    marginLeft: '8px'
                  }}
                >
                  {closestBusInfo.etaText}
                </span>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.85)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  marginTop: '10px',
                  fontSize: '0.75rem',
                  color: '#64748b'
                }}
              >
                <Clock size={14} />
                <span>Monitoring shuttles approaching this stop...</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="nearest-stop-actions">
              <button
                type="button"
                className="btn-stop-primary"
                onClick={handleFocusNearestStop}
              >
                <MapPin size={15} /> Show Walking Route on Map
              </button>
            </div>
          </div>
        ) : gpsStatus === 'locating' ? (
          <div className="card mb-3 nearest-stop-card" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 0' }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  backgroundColor: '#dbeafe',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Loader2 size={24} className="spin" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e40af', margin: '0 0 2px 0' }}>
                  Acquiring your device GPS position...
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#3b82f6', margin: 0 }}>
                  Please click "Allow" in your browser location prompt to find your nearest stop.
                </p>
              </div>
              <div className="gps-auto-sync-badge">
                <span className="auto-sync-pulse" />
                <span className="auto-sync-text">Acquiring (5s)</span>
              </div>
            </div>
          </div>
        ) : gpsStatus === 'denied' ? (
          <div className="card mb-3 nearest-stop-card" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 0' }}>
              <AlertTriangle size={28} style={{ color: '#d97706', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#92400e', margin: '0 0 2px 0' }}>
                  Location Permission Blocked
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#b45309', margin: 0 }}>
                  To find your nearest stop from your live position, please allow location in your browser address bar.
                </p>
              </div>
              <div className="gps-auto-sync-badge" style={{ background: '#fef3c7', borderColor: '#fde68a', color: '#92400e' }}>
                <span className="auto-sync-pulse" style={{ backgroundColor: '#f59e0b' }} />
                <span className="auto-sync-text">Auto-retrying (5s)</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="card mb-3 nearest-stop-card" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 0' }}>
              <Radio size={28} style={{ color: '#64748b', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', margin: '0 0 2px 0' }}>
                  Detecting Nearest Stop
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>
                  Nearest stop is calculated strictly and exclusively using your authentic device GPS coordinates.
                </p>
              </div>
              <div className="gps-auto-sync-badge">
                <span className="auto-sync-pulse" />
                <span className="auto-sync-text">Auto-detecting (5s)</span>
              </div>
            </div>
          </div>
        )}

        {/* 5. Interactive Route Progress Stepper (Timeline) */}
        {selectedBus?.route && stops.length > 0 && (
          <div className="card mb-3 route-stepper-card">
            <div className="flex-between mb-2">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Navigation size={15} style={{ color: 'var(--blue)' }} />
                <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {selectedBus.route.name}
                </strong>
                <span className="text-xs text-muted">({stops.length} Stops)</span>
              </div>

              {selectedEta?.nextStop && (
                <span className="stepper-eta-chip">
                  <Clock size={12} />
                  <span>Next: {selectedEta.etaText}</span>
                </span>
              )}
            </div>

            <p className="text-xs text-muted" style={{ marginBottom: '10px' }}>
              Tap any stop to zoom and view details on the map:
            </p>

            <div className="route-stepper-scroll">
              {stops.map((stop, idx) => {
                const isNext =
                  selectedEta?.nextStop?.id === stop.id ||
                  (selectedEta?.nextStop?.seq === stop.seq && selectedEta?.nextStop?.name === stop.name);

                const isNearest = nearestStop?.id === stop.id;

                return (
                  <button
                    key={stop.id || idx}
                    type="button"
                    className={`stepper-stop-item ${isNext ? 'next-stop' : ''} ${isNearest ? 'nearest-stop' : ''}`}
                    onClick={() => handleSelectStop(stop)}
                    title={`Zoom to Stop #${stop.seq}: ${stop.name}`}
                  >
                    <div className="stepper-stop-badge">
                      {isNearest ? '★' : stop.seq}
                    </div>

                    <div className="stepper-stop-info">
                      <span className="stepper-stop-name">{stop.name}</span>
                      {isNext && (
                        <span className="stepper-approaching-tag">
                          {selectedEta?.isArriving ? 'Arriving Now' : `ETA ${selectedEta?.etaText}`}
                        </span>
                      )}
                      {isNearest && !isNext && (
                        <span className="stepper-nearest-tag">
                          Nearest to your GPS
                        </span>
                      )}
                    </div>

                    {idx < stops.length - 1 && (
                      <div className="stepper-connector-line" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 6. Fleet Shuttles Header & Search */}
        <div className="flex-between mb-3" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Campus Shuttle Fleet</h2>
            <p className="text-xs text-muted">
              {liveBuses.length} Active • {buses.length} Fleet Total
            </p>
          </div>

          <div className="fleet-auto-sync-badge">
            <span className="auto-sync-pulse" />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Auto-refreshing every 5s
            </span>
          </div>
        </div>

        {/* Shuttle Search Filter */}
        <div className="shuttle-search-bar mb-3">
          <Search size={15} style={{ color: 'var(--gray-400)' }} />
          <input
            type="text"
            className="search-input"
            placeholder="Search by bus number or route name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
            >
              ✕
            </button>
          )}
        </div>

        {/* 7. Bus List Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredBuses.map((bus) => (
            <BusCard
              key={bus.id}
              bus={bus}
              stops={getStopsForBus(bus)}
              isSelected={bus.id === (selectedBus?.id || selectedBusId)}
              onSelect={handleSelectBus}
            />
          ))}

          {filteredBuses.length === 0 && (
            <div className="card text-center" style={{ padding: '30px' }}>
              <p className="text-muted text-sm">No shuttles found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
