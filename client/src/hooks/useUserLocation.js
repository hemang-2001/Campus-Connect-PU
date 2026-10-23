import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook to obtain and continuously watch the user's authentic device GPS telemetry.
 * Automatically falls back from hardware satellite GPS to network geolocation if needed.
 */
export function useUserLocation() {
  const [userLocation, setUserLocation] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('locating'); // 'locating' | 'active' | 'denied' | 'error' | 'manual'
  const [gpsError, setGpsError] = useState(null);

  const watchIdRef = useRef(null);
  const mountedRef = useRef(true);

  // Clear any existing GPS watch
  const clearCurrentWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Primary GPS acquisition and watcher setup
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

      const loc = {
        lat: latitude,
        lng: longitude,
        accuracy: accuracy ? Math.round(accuracy) : 15,
        heading: heading || 0,
        speed: speed || 0,
        source: 'gps',
        name: 'My GPS Location',
        timestamp: position.timestamp || Date.now()
      };

      setUserLocation(loc);
      setGpsStatus('active');
      setGpsError(null);

      // Save latest position to sessionStorage for quick warm restore
      try {
        sessionStorage.setItem('campus_connect_user_gps', JSON.stringify(loc));
      } catch (e) {
        // ignore
      }

      // Attach continuous live watcher if not already running
      if (watchIdRef.current === null) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            if (!mountedRef.current) return;
            setUserLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : 15,
              heading: pos.coords.heading || 0,
              speed: pos.coords.speed || 0,
              source: 'gps',
              name: 'My GPS Location',
              timestamp: pos.timestamp || Date.now()
            });
            setGpsStatus('active');
          },
          (watchErr) => {
            console.warn('GPS continuous watch notice:', watchErr.message);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 5000,
            timeout: 15000
          }
        );
      }
    };

    const handleFallback = () => {
      // Retry with standard WiFi / cellular network location (no high accuracy)
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        (finalErr) => {
          if (!mountedRef.current) return;
          if (finalErr.code === 1) {
            setGpsStatus('denied');
            setGpsError('Location permission was denied. Please allow location access in your browser.');
          } else {
            setGpsStatus('error');
            setGpsError('Unable to acquire GPS signal. Tap anywhere on the map to set your spot.');
          }
        },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 30000 }
      );
    };

    // Attempt high-accuracy GPS fix first
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (firstErr) => {
        if (!mountedRef.current) return;
        if (firstErr.code === 1) {
          // Permission denied explicitly
          setGpsStatus('denied');
          setGpsError('Location permission denied. Please enable location permissions for this site.');
        } else {
          // Timeout or hardware unavailable (common on desktop PCs) -> fallback
          handleFallback();
        }
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 3000 }
    );
  }, [clearCurrentWatch]);

  // Allow manual override (e.g. clicking on the map)
  const setManualLocation = useCallback((point) => {
    clearCurrentWatch();
    setUserLocation({
      ...point,
      source: 'manual',
      name: point.name || 'Pinned Map Location',
      timestamp: Date.now()
    });
    setGpsStatus('manual');
    setGpsError(null);
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
    requestLocation,
    setManualLocation,
    setUserLocation
  };
}
