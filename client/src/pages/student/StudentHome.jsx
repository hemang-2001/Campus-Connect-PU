import React, { useState, useEffect } from 'react';
import MapView from '../../components/MapView';
import BusCard from '../../components/BusCard';
import Loader from '../../components/Loader';
import ErrorState from '../../components/ErrorState';
import { useBusLocations, FALLBACK_STOPS } from '../../hooks/useBusLocations';
import { supabase } from '../../lib/supabaseClient';
import { getBusETA } from '../../lib/eta';
import { RefreshCw, Navigation, MapPin, Clock } from 'lucide-react';

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
      />

      {/* Shuttle Drawer / Cards Section */}
      <div style={{ padding: '16px' }}>
        <div className="flex-between mb-3">
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Campus Shuttles</h2>
            <p className="text-xs text-muted">
              {liveCount} Live • {mockCount} Simulated • {buses.length} Fleet Total
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
