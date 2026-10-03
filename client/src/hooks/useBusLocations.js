import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, API_BASE, MOCK_TRACKING } from '../lib/supabaseClient';
import { getNextMockLocation } from '../lib/mockTracker';

export const FALLBACK_STOPS = {
  default: [
    { id: '1', name: 'Campus Main Gate', lat: 28.6139, lng: 77.2090, seq: 1 },
    { id: '2', name: 'Science & Tech Block', lat: 28.6185, lng: 77.2145, seq: 2 },
    { id: '3', name: 'Central Library & Arts', lat: 28.6240, lng: 77.2210, seq: 3 }
  ],
  hostel: [
    { id: 'h1', name: 'Hostel Complex East', lat: 28.6080, lng: 77.2020, seq: 1 },
    { id: 'h2', name: 'Sports Complex Arena', lat: 28.6110, lng: 77.2060, seq: 2 }
  ]
};

/**
 * Custom hook to maintain real-time bus locations
 * Combines initial REST load, Supabase Realtime WebSocket changes, and optional mock simulation.
 */
export function useBusLocations() {
  const [buses, setBuses] = useState([]);
  const [stopsByRoute, setStopsByRoute] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBusId, setSelectedBusId] = useState(null);
  const busesRef = useRef([]);

  busesRef.current = buses;

  // Load all route stops from Supabase once
  useEffect(() => {
    async function fetchAllStops() {
      try {
        const { data, error: stopErr } = await supabase
          .from('bus_stops')
          .select('*')
          .order('seq', { ascending: true });

        if (!stopErr && data && data.length > 0) {
          const grouped = {};
          data.forEach((stop) => {
            if (!grouped[stop.route_id]) {
              grouped[stop.route_id] = [];
            }
            grouped[stop.route_id].push(stop);
          });
          setStopsByRoute(grouped);
        }
      } catch (err) {
        console.warn('Could not pre-load all route stops:', err);
      }
    }
    fetchAllStops();
  }, []);

  // Helper to get stops for a given bus
  const getStopsForBus = useCallback((bus) => {
    if (!bus) return [];
    if (bus.route?.id && stopsByRoute[bus.route.id]?.length > 0) {
      return stopsByRoute[bus.route.id];
    }
    const isHostel = bus.route?.name?.toLowerCase().includes('hostel');
    return isHostel ? FALLBACK_STOPS.hostel : FALLBACK_STOPS.default;
  }, [stopsByRoute]);

  // Initial load from Express API
  const fetchActiveBuses = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/tracking/active`);
      if (!res.ok) {
        throw new Error(`Failed to load buses: ${res.statusText}`);
      }
      const data = await res.json();
      setBuses(data.buses || []);
      if (!selectedBusId && data.buses && data.buses.length > 0) {
        const firstActive = data.buses.find((b) => b.status && b.status.toUpperCase() !== 'OFFLINE');
        setSelectedBusId(firstActive ? firstActive.id : data.buses[0].id);
      }
    } catch (err) {
      console.error('Error in useBusLocations fetch:', err);
      setError(err.message || 'Unable to connect to bus tracking service');
    } finally {
      setLoading(false);
    }
  }, [selectedBusId]);

  useEffect(() => {
    fetchActiveBuses();
  }, [fetchActiveBuses]);

  // 2. Supabase Realtime Subscription for bus_locations table
  useEffect(() => {
    const channel = supabase
      .channel('public:bus_locations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bus_locations'
        },
        (payload) => {
          // When a bus location is deleted (e.g. driver stopped broadcasting or turned off location):
          if (payload.eventType === 'DELETE') {
            const deletedBusId = payload.old?.bus_id;
            if (deletedBusId) {
              setBuses((prevBuses) =>
                prevBuses.map((bus) =>
                  bus.id === deletedBusId
                    ? {
                        ...bus,
                        status: 'OFFLINE',
                        location: null,
                        has_active_driver: false
                      }
                    : bus
                )
              );
            }
            return;
          }

          const updatedLoc = payload.new;
          if (!updatedLoc || !updatedLoc.bus_id) return;

          setBuses((prevBuses) =>
            prevBuses.map((bus) => {
              if (bus.id === updatedLoc.bus_id) {
                return {
                  ...bus,
                  status: updatedLoc.is_mock ? 'MOCK' : 'LIVE',
                  has_active_driver: true,
                  location: updatedLoc
                };
              }
              return bus;
            })
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 3. Stale Watchdog: If a bus is marked LIVE but hasn't received a location fix in >45 seconds, mark it OFFLINE
  useEffect(() => {
    const watchdogInterval = setInterval(() => {
      const now = Date.now();
      setBuses((prevBuses) => {
        let hasChanges = false;
        const nextBuses = prevBuses.map((bus) => {
          if (bus.status === 'LIVE' && bus.location?.updated_at) {
            const ageMs = now - new Date(bus.location.updated_at).getTime();
            if (ageMs > 45000) {
              hasChanges = true;
              return {
                ...bus,
                status: 'OFFLINE',
                has_active_driver: false
              };
            }
          }
          return bus;
        });
        return hasChanges ? nextBuses : prevBuses;
      });
    }, 10000);

    return () => clearInterval(watchdogInterval);
  }, []);

  // 4. Background re-sync every 30 seconds to maintain database consistency
  useEffect(() => {
    const syncInterval = setInterval(() => {
      fetchActiveBuses();
    }, 30000);

    return () => clearInterval(syncInterval);
  }, [fetchActiveBuses]);

  // 3. Mock Tracking Simulation Interval (Active if VITE_MOCK_TRACKING=true)
  useEffect(() => {
    if (!MOCK_TRACKING) return;

    const interval = setInterval(() => {
      setBuses((prevBuses) => {
        // Only simulate buses that are currently in MOCK status or have no LIVE driver
        return prevBuses.map((bus) => {
          if (bus.status === 'LIVE' && bus.has_active_driver) {
            // Live driver is actively sending, do not override with mock
            return bus;
          }

          const mockLoc = getNextMockLocation(bus.id, bus.route?.name);
          return {
            ...bus,
            status: 'MOCK',
            location: {
              ...(bus.location || {}),
              ...mockLoc
            }
          };
        });
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const selectedBus = buses.find((b) => b.id === selectedBusId) || buses[0] || null;

  return {
    buses,
    stopsByRoute,
    getStopsForBus,
    loading,
    error,
    refresh: fetchActiveBuses,
    selectedBusId,
    setSelectedBusId,
    selectedBus
  };
}
