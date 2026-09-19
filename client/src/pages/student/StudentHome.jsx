import React, { useState, useEffect } from 'react';
import MapView from '../../components/MapView';
import BusCard from '../../components/BusCard';
import Loader from '../../components/Loader';
import ErrorState from '../../components/ErrorState';
import { useBusLocations } from '../../hooks/useBusLocations';
import { supabase } from '../../lib/supabaseClient';
import { RefreshCw, Navigation, MapPin } from 'lucide-react';

export default function StudentHome() {
  const {
    buses,
    loading,
    error,
    refresh,
    selectedBusId,
    setSelectedBusId,
    selectedBus
  } = useBusLocations();

  const [stops, setStops] = useState([]);
  const [loadingStops, setLoadingStops] = useState(false);

  // When selected bus changes, load its route's stops
  useEffect(() => {
    async function loadStops() {
      if (!selectedBus?.route?.id) {
        // Fallback default Delhi stops if not linked
        setStops([
          { id: '1', name: 'Campus Main Gate', lat: 28.6139, lng: 77.2090, seq: 1 },
          { id: '2', name: 'Science & Tech Block', lat: 28.6185, lng: 77.2145, seq: 2 },
          { id: '3', name: 'Central Library & Arts', lat: 28.6240, lng: 77.2210, seq: 3 }
        ]);
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
          // Fallback stops for North Loop
          setStops([
            { id: '1', name: 'Campus Main Gate', lat: 28.6139, lng: 77.2090, seq: 1 },
            { id: '2', name: 'Science & Tech Block', lat: 28.6185, lng: 77.2145, seq: 2 },
            { id: '3', name: 'Central Library & Arts', lat: 28.6240, lng: 77.2210, seq: 3 }
          ]);
        } else {
          setStops(data);
        }
      } catch (err) {
        console.warn('Error loading stops:', err);
      } finally {
        setLoadingStops(false);
      }
    }

    loadStops();
  }, [selectedBus?.route?.id]);

  if (loading) {
    return <Loader message="Locating campus shuttles..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  const liveCount = buses.filter((b) => b.status === 'LIVE').length;
  const mockCount = buses.filter((b) => b.status === 'MOCK').length;

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
              padding: '10px 14px',
              backgroundColor: 'var(--blue-light)',
              border: '1px solid rgba(37, 99, 235, 0.2)'
            }}
          >
            <div className="flex-between">
              <span className="flex-row" style={{ color: 'var(--blue)', fontWeight: 700, fontSize: '0.8125rem' }}>
                <Navigation size={14} />
                <span>Route: {selectedBus.route.name}</span>
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--gray-600)', fontWeight: 600 }}>
                {stops.length} Stops
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                paddingTop: '8px',
                scrollbarWidth: 'none'
              }}
            >
              {stops.map((stop) => (
                <div
                  key={stop.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: '#ffffff',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  <MapPin size={12} color="var(--blue)" />
                  <span style={{ fontWeight: 600 }}>{stop.seq}.</span>
                  <span>{stop.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bus List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {buses.map((bus) => (
            <BusCard
              key={bus.id}
              bus={bus}
              isSelected={bus.id === selectedBusId}
              onSelect={(b) => setSelectedBusId(b.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
