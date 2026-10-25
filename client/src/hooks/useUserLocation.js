import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to obtain and stream the user's authentic device GPS telemetry.
 * Strictly uses navigator.geolocation (zero mock fallback, zero manual override).
 * Returns userLocation as null until authentic GPS coordinates are acquired.
 */
export function useUserLocation() {
  const [userLocation, setUserLocation] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('locating'); // 'locating' | 'active' | 'denied' | 'error'
  const [gpsError, setGpsError] = useState(null);
  const [accuracyMeters, setAccuracyMeters] = useState(null);

  const watchIdRef = useRef(null);
  const mountedRef = useRef(true);

  // Clear any active geolocation watch
  const clearCurrentWatch = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Primary GPS acquisition and streaming
  const requestLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsStatus('error');
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setGpsStatus('locating');
    setGpsError(null);
    clearCurrentWatch();

    const handlePositionUpdate = (position) => {
      if (!mountedRef.current) return;
      const { latitude, longitude, accuracy, heading, speed, altitude } = position.coords;
      const acc = accuracy ? Math.round(accuracy) : 10;

      const loc = {
        lat: latitude,
        lng: longitude,
        accuracy: acc,
        heading: heading || 0,
        speed: speed || 0,
        altitude: altitude || null,
        source: 'gps',
        name: `My GPS Location (±${acc}m)`,
        timestamp: position.timestamp || Date.now()
      };

      setUserLocation((prev) => {
        // If we already have a fix, update if newer or better accuracy
        return loc;
      });
      setAccuracyMeters(acc);
      setGpsStatus('active');
      setGpsError(null);
    };

    const handlePositionError = (error) => {
      if (!mountedRef.current) return;
      console.warn('Geolocation notice:', error.code, error.message);

      if (error.code === 1) {
        // PERMISSION_DENIED
        setGpsStatus('denied');
        setGpsError('Location access was denied. Please allow location permissions in your browser address bar.');
      } else if (error.code === 2) {
        // POSITION_UNAVAILABLE
        setGpsStatus('error');
        setGpsError('GPS satellite signal unavailable. Please ensure GPS/Location is enabled on your device.');
      } else if (error.code === 3) {
        // TIMEOUT on strict satellite fix -> try immediate fallback without highAccuracy
        navigator.geolocation.getCurrentPosition(
          handlePositionUpdate,
          (fallbackErr) => {
            if (!mountedRef.current) return;
            setGpsStatus('error');
            setGpsError('GPS signal timed out. Please tap "Refresh GPS" to try again.');
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
        );
      } else {
        setGpsStatus('error');
        setGpsError(error.message || 'Unable to acquire device GPS signal.');
      }
    };

    // 1. Immediately request current high-accuracy position
    navigator.geolocation.getCurrentPosition(
      handlePositionUpdate,
      handlePositionError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0 // Strictly fresh satellite fix
      }
    );

    // 2. Concurrently start continuous watch for live movement & accuracy refinement
    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        (watchErr) => {
          // Do not overwrite active state if watch has a minor hiccup
          console.warn('GPS continuous watch notice:', watchErr.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0
        }
      );
    } catch (e) {
      console.warn('Error starting watchPosition:', e);
    }
  }, [clearCurrentWatch]);

  // Request location automatically on mount
  useEffect(() => {
    mountedRef.current = true;
    requestLocation();

    // Check browser permission changes if supported
    if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'denied') {
          setGpsStatus('denied');
        }
        result.onchange = () => {
          if (result.state === 'granted') {
            requestLocation();
          } else if (result.state === 'denied') {
            setGpsStatus('denied');
          }
        };
      }).catch(() => {});
    }

    return () => {
      mountedRef.current = false;
      clearCurrentWatch();
    };
  }, [requestLocation, clearCurrentWatch]);

  return {
    userLocation,
    gpsStatus,
    gpsError,
    accuracyMeters,
    requestLocation
  };
}
