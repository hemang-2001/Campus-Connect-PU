import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, API_BASE } from '../lib/supabaseClient';
import { playAlertNotificationSound } from '../lib/sound';

const AlertNotificationContext = createContext(null);

const STORAGE_KEY_READ = 'campus_connect_read_alerts_v1';
const STORAGE_KEY_DISMISSED = 'campus_connect_dismissed_banners_v1';
const STORAGE_KEY_SOUND = 'campus_connect_alert_sound_v1';

function getStoredArray(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setStoredArray(key, arr) {
  try {
    localStorage.setItem(key, JSON.stringify(arr));
  } catch (e) {
    console.warn('LocalStorage error:', e);
  }
}

export function AlertNotificationProvider({ children }) {
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeBannerAlert, setActiveBannerAlert] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SOUND);
      return stored !== null ? JSON.parse(stored) : true;
    } catch {
      return true;
    }
  });

  const knownAlertIdsRef = useRef(new Set());
  const initialLoadDoneRef = useRef(false);

  // Update permission status on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Sync sound toggle to localStorage
  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_SOUND, JSON.stringify(next));
      } catch {}
      if (next) {
        playAlertNotificationSound('info');
      }
      return next;
    });
  }, []);

  // Calculate unread count whenever alerts change
  const recalculateUnread = useCallback((currentAlerts) => {
    const readIds = new Set(getStoredArray(STORAGE_KEY_READ));
    const unread = currentAlerts.filter((a) => !readIds.has(a.id)).length;
    setUnreadCount(unread);
  }, []);

  // Trigger Native OS Web Notification
  const triggerNativeNotification = useCallback((alertItem) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const title = `🚨 [Campus Alert] ${alertItem.title}`;
    const body = alertItem.body;
    const icon = '/icons/icon-192.svg';
    const tag = `campus-alert-${alertItem.id}`;

    // Prefer Service Worker showNotification if active
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          body,
          icon,
          badge: '/icons/icon.svg',
          tag,
          vibrate: [200, 100, 200],
          data: { url: '/alerts', id: alertItem.id }
        }).catch(() => {
          // Fallback to standard constructor
          try {
            new Notification(title, { body, icon, tag });
          } catch {}
        });
      });
    } else {
      try {
        new Notification(title, { body, icon, tag });
      } catch {}
    }
  }, []);

  // Trigger floating app heads-up notification banner
  const presentAlertNotification = useCallback((alertItem, isLive = true) => {
    // 1. Set active banner
    setActiveBannerAlert(alertItem);

    // 2. Play sound if enabled
    if (soundEnabled) {
      playAlertNotificationSound(alertItem.severity);
    }

    // 3. Trigger haptic vibration on mobile devices
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      const pattern = alertItem.severity === 'critical' ? [200, 100, 200, 100, 300] : [150, 75, 150];
      navigator.vibrate(pattern);
    }

    // 4. Trigger native push notification
    if (isLive) {
      triggerNativeNotification(alertItem);
    }
  }, [soundEnabled, triggerNativeNotification]);

  // Fetch alerts from API
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/alerts`);
      if (!res.ok) return;

      const data = await res.json();
      const fetchedAlerts = data.alerts || [];
      setAlerts(fetchedAlerts);
      recalculateUnread(fetchedAlerts);

      // Check if there are newly added alerts that we haven't seen in this session
      if (initialLoadDoneRef.current) {
        for (const alert of fetchedAlerts) {
          if (!knownAlertIdsRef.current.has(alert.id)) {
            knownAlertIdsRef.current.add(alert.id);
            presentAlertNotification(alert, true);
            break; // Show newest
          }
        }
      } else {
        // Initial load: populate known IDs without popping up historical alerts
        fetchedAlerts.forEach((a) => knownAlertIdsRef.current.add(a.id));
        initialLoadDoneRef.current = true;
      }
    } catch (err) {
      console.warn('[AlertNotificationContext] Error fetching alerts:', err);
    }
  }, [presentAlertNotification, recalculateUnread]);

  // Initial fetch and 25s polling fallback
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 25000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // Supabase Realtime subscription for instant alert dispatch
  useEffect(() => {
    const channel = supabase
      .channel('public:alerts:broadcast')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        async (payload) => {
          const newAlert = payload.new;
          if (!newAlert || !newAlert.id) return;

          // Fetch enriched alert (with route relation)
          try {
            const { data } = await supabase
              .from('alerts')
              .select(`
                id,
                title,
                body,
                severity,
                route_id,
                created_at,
                route:routes(id, name, color)
              `)
              .eq('id', newAlert.id)
              .maybeSingle();

            const alertToDisplay = data || newAlert;

            setAlerts((prev) => [alertToDisplay, ...prev.filter((a) => a.id !== alertToDisplay.id)]);
            knownAlertIdsRef.current.add(alertToDisplay.id);
            setUnreadCount((prev) => prev + 1);

            // Present the app notification immediately!
            presentAlertNotification(alertToDisplay, true);
          } catch (err) {
            console.warn('[AlertNotificationContext] Realtime alert processing error:', err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [presentAlertNotification]);

  // Dismiss current banner
  const dismissBanner = useCallback(() => {
    if (activeBannerAlert?.id) {
      const dismissed = getStoredArray(STORAGE_KEY_DISMISSED);
      if (!dismissed.includes(activeBannerAlert.id)) {
        setStoredArray(STORAGE_KEY_DISMISSED, [activeBannerAlert.id, ...dismissed.slice(0, 50)]);
      }
    }
    setActiveBannerAlert(null);
  }, [activeBannerAlert]);

  // Mark single alert as read
  const markAsRead = useCallback((alertId) => {
    const read = getStoredArray(STORAGE_KEY_READ);
    if (!read.includes(alertId)) {
      const updated = [alertId, ...read];
      setStoredArray(STORAGE_KEY_READ, updated);
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  }, []);

  // Mark all alerts as read
  const markAllAsRead = useCallback(() => {
    const allIds = alerts.map((a) => a.id);
    setStoredArray(STORAGE_KEY_READ, allIds);
    setUnreadCount(0);
  }, [alerts]);

  // Request browser notification permission
  const requestSystemPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('System notifications are not supported in this browser.');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setNotificationPermission(result);

      if (result === 'granted') {
        // Show confirmation test notification
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification('🔔 Campus Notifications Active', {
            body: 'You will now receive real-time alerts for shuttle delays and campus notices.',
            icon: '/icons/icon-192.svg',
            badge: '/icons/icon.svg'
          });
        } else {
          new Notification('🔔 Campus Notifications Active', {
            body: 'You will now receive real-time alerts for shuttle delays and campus notices.',
            icon: '/icons/icon-192.svg'
          });
        }
        playAlertNotificationSound('info');
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Error requesting notification permission:', err);
      return false;
    }
  }, []);

  // Trigger a test alert to simulate the experience
  const triggerTestAlert = useCallback((severity = 'warning') => {
    const testTitles = {
      critical: '🚨 Emergency Route Diversion — Main Gate 1 Closed',
      warning: '⚠️ Route 2 Delay: Shuttle running 8-10 mins late',
      info: 'ℹ️ Weekend Shuttle Schedule Update for Hostel Block'
    };

    const testBodies = {
      critical: 'Due to road re-carpeting at PU Gate 1, all campus shuttles are re-routed via East Security Gate 3 until 6:00 PM.',
      warning: 'Heavy student transit rush near Science Block. Extra shuttle dispatched from Central Depot in 5 minutes.',
      info: 'Late evening library shuttles will operate every 15 minutes between Hostel and Silver Jubilee campus.'
    };

    const testItem = {
      id: `test-${Date.now()}`,
      title: testTitles[severity] || testTitles.warning,
      body: testBodies[severity] || testBodies.warning,
      severity,
      created_at: new Date().toISOString(),
      route: { name: severity === 'warning' ? 'Hostel Shuttle Express' : 'Campus Ring Route' },
      isTest: true
    };

    presentAlertNotification(testItem, true);
  }, [presentAlertNotification]);

  const value = {
    alerts,
    unreadCount,
    activeBannerAlert,
    notificationPermission,
    soundEnabled,
    fetchAlerts,
    dismissBanner,
    markAsRead,
    markAllAsRead,
    toggleSound,
    requestSystemPermission,
    triggerTestAlert,
    presentAlertNotification
  };

  return (
    <AlertNotificationContext.Provider value={value}>
      {children}
    </AlertNotificationContext.Provider>
  );
}

export function useAlertNotifications() {
  const context = useContext(AlertNotificationContext);
  if (!context) {
    throw new Error('useAlertNotifications must be used within an AlertNotificationProvider');
  }
  return context;
}
