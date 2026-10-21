import React, { useState, useEffect, useMemo } from 'react';
import MapView from '../../components/MapView';
import BusCard from '../../components/BusCard';
import Loader from '../../components/Loader';
import ErrorState from '../../components/ErrorState';
import { useBusLocations, FALLBACK_STOPS } from '../../hooks/useBusLocations';
import { supabase } from '../../lib/supabaseClient';
import { getBusETA, findNearestStop, getClosestBusToStop } from '../../lib/eta';
import { RefreshCw, Navigation, MapPin, Clock, Bus } from 'lucide-react';

const CAMPUS_PRESETS = [
  { label: '🏛️ Main Gate 1', name: 'University Main Gate 1', lat: 12.019596, lng: 79.859077 },
  { label: '📚 Library / MBA', name: 'Reading Room/MBA Department', lat: 12.020898, lng: 79.855204 },
  { label: '🏥 Health Center', name: 'Health Care Center', lat: 12.019434, lng: 79.850250 },
  { label: '🎭 Open Air Theatre', name: 'Open Air Theatre', lat: 12.026560, lng: 79.847402 },
  { label: '🏨 Hostel Mess', name: 'Mother Teresa Mess', lat: 12.022298, lng: 79.847990 },
  { label: '🎓 Silver Jubilee', name: 'Silver Jubilee Campus', lat: 12.033146, lng: 79.857535 }
];

export default function StudentHome() {
  const {
    buses,
    loading,
    error,
    refresh,
    selectedBusId,
    setSelectedBusId,
    selectedBus,
    getStopsForBus
  } = useBusLocations();

  const [stops, setStops] = useState([]);
  const [loadingStops, setLoadingStops] = useState(false);

  // User location defaults to campus center / Main Gate so nearest stop is immediately available
  const [userLocation, setUserLocation] = useState(() => {
    try {
      const saved = localStorage.getItem('campus_connect_user_loc');
      return saved ? JSON.parse(saved) : CAMPUS_PRESETS[0];
    } catch {
      return CAMPUS_PRESETS[0];
    }
  });

  const [focusTarget, setFocusTarget] = useState(null);

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

  const handleUserLocationChange = (newLoc) => {
    setUserLocation(newLoc);
    try {
      localStorage.setItem('campus_connect_user_loc', JSON.stringify(newLoc));
    } catch (e) {
      // ignore
    }
  };

  const handleSelectPreset = (preset) => {
    const loc = {
      lat: preset.lat,
      lng: preset.lng,
      accuracy: 10,
      source: 'preset',
      name: preset.name
    };
    handleUserLocationChange(loc);
    setFocusTarget({
      lat: preset.lat,
      lng: preset.lng,
      zoom: 16,
      timestamp: Date.now()
    });
  };

  // Find nearest stop from user location
  const nearestStop = useMemo(() => {
    return findNearestStop(userLocation, stops);
  }, [userLocation, stops]);

  // Find closest approaching bus to the nearest stop
  const closestBusInfo = useMemo(() => {
    return getClosestBusToStop(nearestStop, buses);
  }, [nearestStop, buses]);

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
  const mockCount = buses.filter((b) => b.status === 'MOCK').length;
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
        onUserLocationChange={handleUserLocationChange}
        nearestStop={nearestStop}
        focusTarget={focusTarget}
      />

      {/* Shuttle Drawer / Cards Section */}
      <div style={{ padding: '16px' }}>
        {/* Nearest Bus Stop Interactive Card */}
        <div className={`card mb-3 ${nearestStop ? 'nearest-stop-card' : 'nearest-stop-card idle'}`}>
          <div className="flex-between mb-2">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)'
                }}
              >
                <MapPin size={18} />
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
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: '1px 0' }}>
                  {nearestStop ? nearestStop.name : 'University Main Gate 1'}
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                  From: <strong>{userLocation?.name || 'Your Location'}</strong>
                </div>
              </div>
            </div>

            {nearestStop && (
              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    backgroundColor: '#d1fae5',
                    color: '#065f46',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
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

          {/* Closest Bus to this stop */}
          {closestBusInfo ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'rgba(255, 255, 255, 0.85)',
                padding: '8px 12px',
                borderRadius: '8px',
                marginTop: '6px',
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
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                padding: '6px 12px',
                borderRadius: '6px',
                marginTop: '6px',
                fontSize: '0.75rem',
                color: '#64748b'
              }}
            >
              <Clock size={13} />
              <span>Monitoring shuttles approaching this stop...</span>
            </div>
          )}

          {/* Actions & Landmark Quick Selectors */}
          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(16, 185, 129, 0.15)' }}>
            <div className="flex-between mb-1">
              <span style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 700 }}>
                📍 Change your spot (or tap directly on map):
              </span>
              {nearestStop && (
                <button
                  type="button"
                  onClick={handleFocusNearestStop}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#059669',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline'
                  }}
                >
                  View Stop on Map &rarr;
                </button>
              )}
            </div>

            <div className="preset-pills-wrap">
              {CAMPUS_PRESETS.map((preset) => {
                const isSelected =
                  userLocation?.name === preset.name ||
                  (userLocation &&
                    Math.abs(userLocation.lat - preset.lat) < 0.0001 &&
                    Math.abs(userLocation.lng - preset.lng) < 0.0001);

                return (
                  <button
                    key={preset.name}
                    type="button"
                    className={`preset-pill ${isSelected ? 'active' : ''}`}
                    onClick={() => handleSelectPreset(preset)}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

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
