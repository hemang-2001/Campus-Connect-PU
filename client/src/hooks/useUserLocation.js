import { useState, useEffect, useRef, useCallback } from 'react';

// Authentic Pondicherry University Central Campus Location (Default starting fallback)
export const DEFAULT_CAMPUS_LOCATION = {
  lat: 12.020898,
  lng: 79.855204, // Central Library / MBA Department, Pondicherry University
  accuracy: 10,
  heading: 0,
  speed: 0,
  source: 'campus_default',
  name: 'Central Library / MBA (Campus)',
  timestamp: Date.now()
};

// Restore cached location or fallback to default campus location
function getInitialLocation() {
  try {
    const cached = sessionStorage.getItem('campus_connect_user_gps');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.lat && parsed?.lng) {
        return parsed;
      }
    }
  } catch (e) {
    // ignore
  }
  return DEFAULT_CAMPUS_LOCATION;
}

/**
 * Custom hook to obtain and watch the student's authentic device GPS telemetry.
 * Uses high-accuracy satellite GPS without caching stale positions (maximumAge: 0).
 * Never discards the user's authentic coordinates.
 */
export function useUserLocation() {
  const [userLocation, setUserLocation] = useState(getInitialLocation);
  const [gpsStatus, setGpsStatus] = useState('locating'); // 'locating' | 'active' | 'denied' | 'error' | 'manual'
  const [gpsError, setGpsError] = useState(null);
  const [accuracyMeters, setAccuracyMeters] = useState(null);

  const watchIdRef = useRef(null);
  const mountedRef = useRef(true);

  // Clear any active geolocation watch
  const clearCurrentWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Primary GPS acquisition with true high-accuracy satellite fix
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setGpsStatus('locating');
    setGpsError(null);
    clearCurrentWatch();

    const handleSuccess = (position) => {
      if (!mountedRef.current) return;
      const { latitude, longitude, accuracy, heading, speed } = position.coords;
      const acc = accuracy ? Math.round(accuracy) : 10;

      const loc = {
        lat: latitude,
        lng: longitude,
        accuracy: acc,
        heading: heading || 0,
        speed: speed || 0,
        source: 'gps',
        name: `My GPS Location (±${acc}m)`,
        timestamp: position.timestamp || Date.now()
      };

      // Always set user location to their authentic device coordinates!
      setUserLocation(loc);
      setAccuracyMeters(acc);
      setGpsStatus('active');
      setGpsError(null);

      try {
        sessionStorage.setItem('campus_connect_user_gps', JSON.stringify(loc));
      } catch (e) {
        // ignore
      }

      // Attach continuous live watcher for refined positioning
      if (watchIdRef.current === null) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            if (!mountedRef.current) return;
            const liveAcc = pos.coords.accuracy ? Math.round(pos.coords.accuracy) : 10;
            const updatedLoc = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: liveAcc,
              heading: pos.coords.heading || 0,
              speed: pos.coords.speed || 0,
              source: 'gps',
              name: `My GPS Location (±${liveAcc}m)`,
              timestamp: pos.timestamp || Date.now()
            };

            setUserLocation(updatedLoc);
            setAccuracyMeters(liveAcc);
            setGpsStatus('active');
          },
          (watchErr) => {
            console.warn('GPS continuous watch notice:', watchErr.message);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0, // Force fresh real-time satellite fixes, no stale cache
            timeout: 20000
          }
        );
      }
    };

    const handleError = (error) => {
      if (!mountedRef.current) return;
      console.warn('Geolocation error:', error.code, error.message);
      if (error.code === 1) {
        setGpsStatus('denied');
        setGpsError('Location permission denied. Please allow location access in your browser.');
      } else if (error.code === 2) {
        setGpsStatus('error');
        setGpsError('GPS signal unavailable. You can drag the blue pin on the map to set your location.');
      } else if (error.code === 3) {
        // High accuracy satellite GPS timed out -> try standard accuracy as fallback
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          (finalErr) => {
            if (!mountedRef.current) return;
            setGpsStatus('error');
            setGpsError('Location timed out. Drag the blue pin on the map or tap any campus spot.');
          },
          { enableHighAccuracy: false, timeout: 12000, maximumAge: 0 }
        );
      } else {
        setGpsStatus('error');
        setGpsError(error.message || 'Unable to acquire GPS signal.');
      }
    };

    // Request fresh high-accuracy satellite GPS fix (maximumAge: 0 ensures non-stale fix)
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0 // Do not use stale cached coordinates
      }
    );
  }, [clearCurrentWatch]);

  // Set manual location (tapping map, dragging pin, or picking a campus spot)
  const setManualLocation = useCallback((point) => {
    clearCurrentWatch();
    const newPoint = {
      ...point,
      source: 'manual',
      name: point.name || 'Custom Pinned Spot',
      timestamp: Date.now()
    };
    setUserLocation(newPoint);
    setAccuracyMeters(point.accuracy || 10);
    setGpsStatus('manual');
    setGpsError(null);

    try {
      sessionStorage.setItem('campus_connect_user_gps', JSON.stringify(newPoint));
    } catch (e) {
      // ignore
    }
  }, [clearCurrentWatch]);

  // Request location automatically on mount
  useEffect(() => {
    mountedRef.current = true;
    requestLocation();

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
    requestLocation,
    setManualLocation,
    setUserLocation
  };
}
