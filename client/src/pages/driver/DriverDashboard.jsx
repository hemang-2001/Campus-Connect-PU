import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, API_BASE } from '../../lib/supabaseClient';
import Badge from '../../components/Badge';
import {
  Radio,
  StopCircle,
  PlayCircle,
  AlertTriangle,
  Compass,
  Gauge,
  Wifi,
  WifiOff,
  Sun,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';

export default function DriverDashboard() {
  const { session } = useAuth();

  // State
  const [buses, setBuses] = useState([]);
  const [selectedBusId, setSelectedBusId] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pointsSentCount, setPointsSentCount] = useState(0);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [currentAccuracyM, setCurrentAccuracyM] = useState(null);
  const [currentCoords, setCurrentCoords] = useState(null);
  const [gpsError, setGpsError] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [wakeLockActive, setWakeLockActive] = useState(false);

  // Refs for tracking logic & throttling
  const watchIdRef = useRef(null);
  const wakeLockRef = useRef(null);
  const intervalIdRef = useRef(null);
  const latestFixRef = useRef(null);
  const lastPushTimeRef = useRef(0);
  const offlineQueueRef = useRef([]);
  const isBroadcastingRef = useRef(false);
  const selectedBusIdRef = useRef('');

  isBroadcastingRef.current = isBroadcasting;
  selectedBusIdRef.current = selectedBusId;

  // 1. Load active buses & restore existing driving assignment on page load
  useEffect(() => {
    async function loadInitialData() {
      try {
        // Load active fleet directly from Supabase
        const { data: busData } = await supabase
          .from('buses')
          .select('id, plate_no, capacity, route:routes(name)')
          .eq('is_active', true);

        if (busData && busData.length > 0) {
          setBuses(busData);
        }

        // Check if current driver already has an active driving session
        if (session?.user?.id) {
          const { data: myAssignment } = await supabase
            .from('driver_assignments')
            .select('bus_id, active')
            .eq('driver_id', session.user.id)
            .eq('active', true)
            .maybeSingle();

          if (myAssignment?.bus_id) {
            setSelectedBusId(myAssignment.bus_id);
            // Driver can restart or resume
          } else if (busData && busData.length > 0) {
            setSelectedBusId(busData[0].id);
          }
        }
      } catch (err) {
        console.error('Error loading driver initial data:', err);
      }
    }

    loadInitialData();
  }, [session]);

  // Request and manage Screen Wake Lock (Step 3)
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        const lock = await navigator.wakeLock.request('screen');
        wakeLockRef.current = lock;
        setWakeLockActive(true);
        lock.addEventListener('release', () => {
          setWakeLockActive(false);
        });
      } catch (err) {
        console.warn('Screen Wake Lock request failed:', err.message);
        setWakeLockActive(false);
      }
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch (e) {
        // ignore
      }
      wakeLockRef.current = null;
      setWakeLockActive(false);
    }
  };

  // Push location fix to server (Step 4 & 5)
  const pushLocation = useCallback(async (fix) => {
    if (!fix || !selectedBusIdRef.current || !session?.access_token) return;

    const now = Date.now();
    // Throttle: skip if <4.5s since last push
    if (now - lastPushTimeRef.current < 4500) {
      return;
    }

    const payload = {
      busId: selectedBusIdRef.current,
      lat: fix.coords.latitude,
      lng: fix.coords.longitude,
      speedKmh: Math.max(0, (fix.coords.speed ?? 0) * 3.6),
      heading: fix.coords.heading ?? 0,
      isMock: false
    };

    try {
      const res = await fetch(`${API_BASE}/api/tracking/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });

      // Step 6: On 403 response: "Session ended — restart broadcast", auto-stop
      if (res.status === 403) {
        setSessionError('Session ended — restart broadcast');
        stopBroadcasting(false); // Stop local broadcast
        return;
      }

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      lastPushTimeRef.current = now;
      setPointsSentCount((c) => c + 1);
      setCurrentSpeedKmh(Math.round(payload.speedKmh));
      setCurrentAccuracyM(Math.round(fix.coords.accuracy || 0));
      setCurrentCoords({ lat: fix.coords.latitude, lng: fix.coords.longitude });
    } catch (err) {
      console.warn('Location push failed, adding to offline queue:', err.message);
      // Step 5: On failure, keep in offlineQueue ref
      offlineQueueRef.current.push(payload);
    }
  }, [session]);

  // Flush offline queue when reconnected (Step 5)
  const flushOfflineQueue = useCallback(async () => {
    if (offlineQueueRef.current.length === 0 || !session?.access_token) return;

    const queueCopy = [...offlineQueueRef.current];
    offlineQueueRef.current = [];

    // Send latest point from queue
    const latestQueuedPoint = queueCopy[queueCopy.length - 1];
    if (latestQueuedPoint) {
      try {
        await fetch(`${API_BASE}/api/tracking/location`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify(latestQueuedPoint)
        });
        setPointsSentCount((c) => c + queueCopy.length);
      } catch (e) {
        // re-queue if still offline
        offlineQueueRef.current = queueCopy;
      }
    }
  }, [session]);

  // Online / Offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushOfflineQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flushOfflineQueue]);

  // Step 1: Start broadcasting GPS location
  const startBroadcasting = async () => {
    setGpsError('');
    setSessionError('');

    if (!selectedBusId) {
      setSessionError('Please select a bus before starting broadcast.');
      return;
    }

    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    try {
      // 1. POST /api/tracking/start { busId } — abort if 409
      const res = await fetch(`${API_BASE}/api/tracking/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ busId: selectedBusId })
      });

      const data = await res.json();
      if (res.status === 409) {
        setSessionError(data.error || 'Bus is already in an active session with another driver.');
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize driving session');
      }

      // 2. Request Screen Wake Lock (Step 3)
      await requestWakeLock();

      // 3. navigator.geolocation.watchPosition (Step 2)
      const options = {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20000
      };

      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          latestFixRef.current = position;
          setGpsError('');
          // Immediately try push if first fix
          if (lastPushTimeRef.current === 0) {
            pushLocation(position);
          }
        },
        (error) => {
          // Map error codes 1, 2, 3 to friendly messages
          switch (error.code) {
            case 1: // PERMISSION_DENIED
              setGpsError('Location permission denied. Please allow location access in your browser settings.');
              break;
            case 2: // POSITION_UNAVAILABLE
              setGpsError('GPS signal unavailable. Please ensure phone location is enabled and move to an open area.');
              break;
            case 3: // TIMEOUT
              setGpsError('Location request timed out. Searching for GPS satellites...');
              break;
            default:
              setGpsError('An unknown GPS error occurred.');
          }
        },
        options
      );

      watchIdRef.current = watchId;

      // 4. setInterval every 5000ms to push latest fix (Step 4)
      const intervalId = setInterval(() => {
        if (latestFixRef.current) {
          pushLocation(latestFixRef.current);
        }
      }, 5000);

      intervalIdRef.current = intervalId;
      setIsBroadcasting(true);
    } catch (err) {
      console.error('Error starting broadcast:', err);
      setSessionError(err.message || 'Could not start broadcast');
    }
  };

  // Step 7: Stop sending and reset state
  const stopBroadcasting = async (callServerStop = true) => {
    // Clear geolocation watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Clear broadcast interval
    if (intervalIdRef.current !== null) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    // Release wake lock
    releaseWakeLock();

    // Notify server
    if (callServerStop && session?.access_token) {
      try {
        await fetch(`${API_BASE}/api/tracking/stop`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });
      } catch (err) {
        console.warn('Error ending server session:', err);
      }
    }

    latestFixRef.current = null;
    lastPushTimeRef.current = 0;
    setIsBroadcasting(false);
    setCurrentSpeedKmh(0);
    setCurrentAccuracyM(null);
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current);
      }
      releaseWakeLock();
    };
  }, []);

  const selectedBus = buses.find((b) => b.id === selectedBusId);

  return (
    <div style={{ padding: '16px 0' }}>
      {/* Top Header */}
      <div className="flex-between mb-4">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Driver Cockpit</h2>
          <p className="text-xs text-muted">Smart Driver Phone Geolocation Broadcaster</p>
        </div>

        <div>
          {isBroadcasting ? (
            isOnline ? (
              <span className="badge badge-live">
                <span className="pulse-dot live" /> BROADCASTING
              </span>
            ) : (
              <span className="badge badge-mock">
                <span className="pulse-dot mock" /> OFFLINE (QUEUED)
              </span>
            )
          ) : (
            <span className="badge badge-offline">STANDBY</span>
          )}
        </div>
      </div>

      {/* Screen & Battery Warning Banner */}
      <div
        className="banner-alert banner-warning"
        style={{ fontSize: '0.8125rem', lineHeight: 1.4 }}
      >
        <AlertTriangle size={18} style={{ flexShrink: 0 }} />
        <div>
          <strong>Driver Notice:</strong> Keep this browser tab open with screen active while
          driving. Phone GPS updates every 5 seconds.
        </div>
      </div>

      {/* Session / Conflict Error */}
      {sessionError && (
        <div className="banner-alert banner-danger" role="alert">
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span>{sessionError}</span>
        </div>
      )}

      {/* GPS Warning / Error */}
      {gpsError && (
        <div className="banner-alert banner-danger" role="alert">
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span>{gpsError}</span>
        </div>
      )}

      {/* Bus Selection & Broadcast Control Card */}
      <div className="card mb-4">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px' }}>
          Select Your Assigned Shuttle
        </h3>

        <div className="form-group">
          <label className="form-label" htmlFor="driver-bus-select">
            Bus Plate / Route
          </label>
          <select
            id="driver-bus-select"
            className="form-select"
            value={selectedBusId}
            onChange={(e) => setSelectedBusId(e.target.value)}
            disabled={isBroadcasting}
          >
            {buses.length === 0 && <option value="">Loading available fleet...</option>}
            {buses.map((bus) => (
              <option key={bus.id} value={bus.id}>
                {bus.plate_no} — {bus.route?.name || 'Campus Loop'} ({bus.capacity} seats)
              </option>
            ))}
          </select>
        </div>

        {!isBroadcasting ? (
          <button
            type="button"
            className="btn btn-primary btn-full btn-lg mt-2"
            onClick={startBroadcasting}
            disabled={!selectedBusId}
          >
            <PlayCircle size={20} />
            <span>Start Sending My Location</span>
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-danger btn-full btn-lg mt-2"
            onClick={() => stopBroadcasting(true)}
          >
            <StopCircle size={20} />
            <span>Stop Sending</span>
          </button>
        )}
      </div>

      {/* Telemetry & Metrics Dashboard */}
      <div className="card">
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '14px' }}>
          Live Telemetry Stream
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px'
          }}
        >
          {/* Points Sent */}
          <div
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--gray-50)',
              border: '1px solid var(--gray-200)'
            }}
          >
            <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '4px' }}>
              Pings Dispatched
            </span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--blue)' }}>
              {pointsSentCount}
            </span>
          </div>

          {/* Current Speed */}
          <div
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--gray-50)',
              border: '1px solid var(--gray-200)'
            }}
          >
            <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '4px' }}>
              GPS Speed
            </span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--gray-800)' }}>
              {currentSpeedKmh} <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>km/h</span>
            </span>
          </div>

          {/* GPS Accuracy */}
          <div
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--gray-50)',
              border: '1px solid var(--gray-200)'
            }}
          >
            <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '4px' }}>
              GPS Accuracy
            </span>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--gray-800)' }}>
              {currentAccuracyM !== null ? `±${currentAccuracyM} m` : 'Acquiring...'}
            </span>
          </div>

          {/* Network Connection */}
          <div
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--gray-50)',
              border: '1px solid var(--gray-200)'
            }}
          >
            <span className="text-xs text-muted" style={{ display: 'block', marginBottom: '4px' }}>
              Connectivity
            </span>
            <span
              className="flex-row"
              style={{
                fontSize: '0.875rem',
                fontWeight: 700,
                color: isOnline ? 'var(--emerald)' : 'var(--amber)'
              }}
            >
              {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
              <span>{isOnline ? 'Online' : 'Offline Buffer'}</span>
            </span>
          </div>
        </div>

        {/* Current Coordinates readout */}
        {currentCoords && (
          <div
            className="flex-between text-xs text-muted"
            style={{
              marginTop: '12px',
              paddingTop: '10px',
              borderTop: '1px solid var(--gray-100)'
            }}
          >
            <span>Coordinates:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
              {currentCoords.lat.toFixed(5)}, {currentCoords.lng.toFixed(5)}
            </span>
          </div>
        )}

        {/* Screen Wake Lock Status */}
        <div
          className="flex-between text-xs text-muted"
          style={{
            marginTop: '8px'
          }}
        >
          <span className="flex-row">
            <Sun size={14} color={wakeLockActive ? '#f59e0b' : '#94a3b8'} />
            <span>Screen WakeLock:</span>
          </span>
          <span style={{ fontWeight: 600, color: wakeLockActive ? '#059669' : '#64748b' }}>
            {wakeLockActive ? 'Active (Screen will stay ON)' : 'Disabled / Standby'}
          </span>
        </div>
      </div>
    </div>
  );
}
