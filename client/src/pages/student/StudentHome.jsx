import React, { useState, useEffect, useMemo, useRef } from 'react';
import MapView from '../../components/MapView';
import BusCard from '../../components/BusCard';
import Loader from '../../components/Loader';
import ErrorState from '../../components/ErrorState';
import { useBusLocations, FALLBACK_STOPS } from '../../hooks/useBusLocations';
import { useUserLocation } from '../../hooks/useUserLocation';
import { supabase } from '../../lib/supabaseClient';
import { getBusETA, findNearestStop, getClosestBusToStop } from '../../lib/eta';
import {
  RefreshCw,
  Navigation,
  MapPin,
  Clock,
  Bus,
  LocateFixed,
  AlertTriangle,
  Loader2
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

  // Authentic device GPS telemetry hook
  const {
    userLocation,
    gpsStatus,
    gpsError,
    requestLocation,
    setManualLocation
  } = useUserLocation();

  const [stops, setStops] = useState([]);
  const [loadingStops, setLoadingStops] = useState(false);
  const [focusTarget, setFocusTarget] = useState(null);
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

  // Find nearest stop from user's live GPS coordinates among all campus stops
  const nearestStop = useMemo(() => {
    const pool = allStops && allStops.length > 0 ? allStops : stops;
    return findNearestStop(userLocation, pool);
  }, [userLocation, allStops, stops]);

  // Find closest approaching bus to the nearest stop
  const closestBusInfo = useMemo(() => {
    return getClosestBusToStop(nearestStop, buses);
  }, [nearestStop, buses]);

  // Auto-center map once when GPS fix is first acquired
  useEffect(() => {
    if (userLocation?.lat && userLocation?.lng && !hasAutoCenteredRef.current) {
      hasAutoCenteredRef.current = true;
      if (nearestStop?.lat && nearestStop?.lng) {
        setFocusTarget({
          lat: nearestStop.lat,
          lng: nearestStop.lng,
          zoom: 16,
          timestamp: Date.now()
        });
      } else {
        setFocusTarget({
          lat: userLocation.lat,
          lng: userLocation.lng,
          zoom: 16,
          timestamp: Date.now()
        });
      }
    }
  }, [userLocation, nearestStop]);

  const handleCenterOnUser = () => {
    if (userLocation?.lat && userLocation?.lng) {
      setFocusTarget({
        lat: userLocation.lat,
        lng: userLocation.lng,
        zoom: 16,
        timestamp: Date.now()
      });
    } else {
      requestLocation();
    }
  };

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

  if (loading) {
    return <Loader message="Locating campus shuttles..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  const liveCount = buses.filter((b) => b.status === 'LIVE').length;
  const selectedEta = selectedBus ? getBusETA(selectedBus, stops) : null;

  return (
    <div>
      {/* Interactive Map */}
      <MapView
        buses={buses}
        stops={stops}
        selectedBus={selectedBus}
        onSelectBus={(bus) => setSelectedBusId(bus.id)}
        userLocation={userLocation}
        onUserLocationChange={setManualLocation}
        nearestStop={nearestStop}
        focusTarget={focusTarget}
        gpsStatus={gpsStatus}
        onRequestGps={requestLocation}
      />

      {/* Shuttle Drawer / Cards Section */}
      <div style={{ padding: '16px' }}>
        {/* 1. Live GPS Status Strip */}
        <div className={`user-gps-strip ${gpsStatus}`}>
          <div className="user-gps-badge">
            {gpsStatus === 'active' && (
              <>
                <span className="pulse-dot live" />
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#065f46' }}>
                    📍 Live GPS Connected
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#047857' }}>
                    Accurate to ±{userLocation?.accuracy || 15}m • Updating in real-time
                  </div>
                </div>
              </>
            )}
            {gpsStatus === 'locating' && (
              <>
                <Loader2 size={16} className="spin" style={{ color: '#2563eb' }} />
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e40af' }}>
                    Acquiring Live GPS...
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#3b82f6' }}>
                    Waiting for device location signal
                  </div>
                </div>
              </>
            )}
            {gpsStatus === 'denied' && (
              <>
                <AlertTriangle size={16} style={{ color: '#d97706' }} />
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#92400e' }}>
                    GPS Permission Blocked
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#b45309' }}>
                    Allow location in browser or click anywhere on the map
                  </div>
                </div>
              </>
            )}
            {gpsStatus === 'error' && (
              <>
                <AlertTriangle size={16} style={{ color: '#dc2626' }} />
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#991b1b' }}>
                    GPS Signal Unavailable
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#b91c1c' }}>
                    {gpsError || 'Tap anywhere on the map to set your location'}
                  </div>
                </div>
              </>
            )}
            {gpsStatus === 'manual' && (
              <>
                <MapPin size={16} style={{ color: '#2563eb' }} />
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b' }}>
                    Custom Pinned Location
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    Showing nearest stop to selected pin
                  </div>
                </div>
              </>
            )}
          </div>

          <div>
            {gpsStatus === 'active' ? (
              <button
                type="button"
                className="btn-gps-outline"
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                onClick={handleCenterOnUser}
                title="Center map on my GPS location"
              >
                <LocateFixed size={13} style={{ color: '#059669' }} /> Center GPS
              </button>
            ) : gpsStatus === 'manual' ? (
              <button
                type="button"
                className="btn-stop-primary"
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                onClick={requestLocation}
              >
                <Navigation size={13} /> Use Live GPS
              </button>
            ) : (
              <button
                type="button"
                className="btn-gps-outline"
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                onClick={requestLocation}
              >
                <RefreshCw size={13} /> Retry GPS
              </button>
            )}
          </div>
        </div>

        {/* 2. Nearest Bus Stop Interactive Card */}
        <div className={`card mb-3 ${nearestStop ? 'nearest-stop-card' : 'nearest-stop-card idle'}`}>
          <div className="flex-between mb-2">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
                  flexShrink: 0
                }}
              >
                <MapPin size={20} />
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
                  Nearest Campus Bus Stop
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '2px 0' }}>
                  {nearestStop ? nearestStop.name : (gpsStatus === 'locating' ? 'Locating nearest stop...' : 'Select a location on map')}
                </h3>
                {nearestStop?.route && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: nearestStop.route.color || '#2563eb'
                      }}
                    />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                      {nearestStop.route.name}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {nearestStop && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    backgroundColor: '#d1fae5',
                    color: '#065f46',
                    borderRadius: '9999px',
                    fontSize: '0.8125rem',
                    fontWeight: 800
                  }}
                >
                  {nearestStop.distanceText || `${nearestStop.distanceMeters}m`}
                </span>
                <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                  ~{nearestStop.walkTimeMinutes} min walk
                </div>
              </div>
            )}
          </div>

          {/* Closest Approaching Bus to Nearest Stop */}
          {closestBusInfo ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                padding: '8px 12px',
                borderRadius: '8px',
                marginTop: '10px',
                fontSize: '0.8125rem',
                border: '1px solid rgba(16, 185, 129, 0.25)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Bus size={15} style={{ color: '#2563eb' }} />
                <span>
                  Approaching Bus: <strong>{closestBusInfo.bus.plate_no}</strong> ({closestBusInfo.bus.route?.name || 'Campus Shuttle'})
                </span>
              </div>
              <span
                style={{
                  fontWeight: 800,
                  color: closestBusInfo.isArriving ? '#059669' : '#2563eb',
                  backgroundColor: closestBusInfo.isArriving ? '#ecfdf5' : '#eff6ff',
                  padding: '2px 8px',
                  borderRadius: '4px'
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
                backgroundColor: 'rgba(255, 255, 255, 0.75)',
                padding: '6px 12px',
                borderRadius: '6px',
                marginTop: '10px',
                fontSize: '0.75rem',
                color: '#64748b'
              }}
            >
              <Clock size={13} />
              <span>Monitoring shuttles approaching this stop...</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="nearest-stop-actions">
            {nearestStop && (
              <button
                type="button"
                className="btn-stop-primary"
                onClick={handleFocusNearestStop}
              >
                <MapPin size={14} /> Show Stop on Map
              </button>
            )}
            {userLocation && (
              <button
                type="button"
                className="btn-gps-outline"
                onClick={handleCenterOnUser}
              >
                <LocateFixed size={14} /> Center on My Location
              </button>
            )}
          </div>
        </div>

        {/* 3. Fleet Shuttles Header */}
        <div className="flex-between mb-3">
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Campus Shuttles</h2>
            <p className="text-xs text-muted">
              {liveCount} Live • {buses.length} Fleet Total
            </p>
          </div>

          <button
            type="button"
            className="btn btn-outline"
            style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
            onClick={refresh}
            title="Refresh Fleet"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Selected Route Stop List Banner */}
        {selectedBus?.route && (
          <div
            className="card mb-3"
            style={{
              padding: '12px 14px',
              backgroundColor: 'var(--blue-light)',
              border: '1px solid rgba(37, 99, 235, 0.2)'
            }}
          >
            <div className="flex-between mb-1">
              <span className="flex-row" style={{ color: 'var(--blue)', fontWeight: 700, fontSize: '0.8125rem' }}>
                <Navigation size={14} />
                <span>Route: {selectedBus.route.name}</span>
              </span>

              {selectedEta?.nextStop ? (
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: selectedEta.isArriving ? '#065f46' : '#1e40af',
                    backgroundColor: selectedEta.isArriving ? '#d1fae5' : '#dbeafe',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Clock size={12} />
                  <span>Next: {selectedEta.etaText}</span>
                </span>
              ) : (
                <span style={{ fontSize: '0.75rem', color: 'var(--gray-600)', fontWeight: 600 }}>
                  {stops.length} Stops
                </span>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                paddingTop: '6px',
                scrollbarWidth: 'none'
              }}
            >
              {stops.map((stop) => {
                const isNext =
                  selectedEta?.nextStop?.id === stop.id ||
                  (selectedEta?.nextStop?.seq === stop.seq && selectedEta?.nextStop?.name === stop.name);

                return (
                  <div
                    key={stop.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      backgroundColor: isNext
                        ? selectedEta?.isArriving
                          ? '#ecfdf5'
                          : '#eff6ff'
                        : '#ffffff',
                      border: isNext
                        ? `1.5px solid ${selectedEta?.isArriving ? 'var(--emerald)' : 'var(--blue)'}`
                        : '1px solid var(--border-subtle)',
                      padding: '5px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      whiteSpace: 'nowrap',
                      boxShadow: isNext ? '0 0 0 2px var(--blue-glow)' : '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <MapPin
                      size={13}
                      color={
                        isNext
                          ? selectedEta?.isArriving
                            ? 'var(--emerald)'
                            : 'var(--blue)'
                          : 'var(--gray-500)'
                      }
                    />
                    <span style={{ fontWeight: isNext ? 700 : 600 }}>
                      {stop.seq}. {stop.name}
                    </span>
                    {isNext && (
                      <span
                        style={{
                          backgroundColor: selectedEta?.isArriving ? 'var(--emerald)' : 'var(--blue)',
                          color: '#ffffff',
                          fontSize: '0.625rem',
                          fontWeight: 800,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          marginLeft: '2px'
                        }}
                      >
                        {selectedEta?.isArriving ? 'Here' : selectedEta?.etaText}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bus List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {buses.map((bus) => (
            <BusCard
              key={bus.id}
              bus={bus}
              stops={getStopsForBus(bus)}
              isSelected={bus.id === selectedBusId}
              onSelect={(b) => setSelectedBusId(b.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
