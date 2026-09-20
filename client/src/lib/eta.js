
export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


export function findNextStop(busCoords, stops = []) {
  if (!busCoords?.lat || !busCoords?.lng || !stops || stops.length === 0) {
    return { nextStop: null, distanceMeters: 0 };
  }

  // Sort stops by sequence
  const sortedStops = [...stops].sort((a, b) => (a.seq || 0) - (b.seq || 0));

  if (sortedStops.length === 1) {
    const dist = getDistanceMeters(busCoords.lat, busCoords.lng, sortedStops[0].lat, sortedStops[0].lng);
    return { nextStop: sortedStops[0], distanceMeters: Math.round(dist) };
  }

  const { lat: pLat, lng: pLng } = busCoords;
  let minPerpDistance = Infinity;
  let selectedNextStop = sortedStops[0];

  // Evaluate each segment between consecutive stops (including loop-back to start)
  for (let i = 0; i < sortedStops.length; i++) {
    const stopA = sortedStops[i];
    const stopB = sortedStops[(i + 1) % sortedStops.length];

    const latA = stopA.lat;
    const lngA = stopA.lng;
    const latB = stopB.lat;
    const lngB = stopB.lng;

    // Convert coordinates to metric approximation around segment centroid
    const midLatRad = ((latA + latB) / 2 * Math.PI) / 180;
    const degLatToM = 111320;
    const degLngToM = 111320 * Math.cos(midLatRad);

    const dx = (lngB - lngA) * degLngToM;
    const dy = (latB - latA) * degLatToM;
    const segLenSq = dx * dx + dy * dy;

    if (segLenSq === 0) continue;

    // Project bus position onto segment vector AB
    const px = (pLng - lngA) * degLngToM;
    const py = (pLat - latA) * degLatToM;
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / segLenSq));

    // Closest point on segment
    const closestX = lngA * degLngToM + t * dx;
    const closestY = latA * degLatToM + t * dy;

    const busX = pLng * degLngToM;
    const busY = pLat * degLatToM;
    const perpDist = Math.hypot(busX - closestX, busY - closestY);

    if (perpDist < minPerpDistance) {
      minPerpDistance = perpDist;
      // If projection is very close to stopB (t > 0.95), target the following stop
      if (t > 0.95 && sortedStops.length > 2) {
        selectedNextStop = sortedStops[(i + 2) % sortedStops.length];
      } else {
        selectedNextStop = stopB;
      }
    }
  }

  const distanceMeters = Math.round(
    getDistanceMeters(pLat, pLng, selectedNextStop.lat, selectedNextStop.lng)
  );

  return { nextStop: selectedNextStop, distanceMeters };
}

/**
 * Calculates estimated travel time based on distance and speed
 * @param {number} distanceMeters
 * @param {number} [speedKmh=0]
 * @returns {{ etaText: string, etaMinutes: number, distanceText: string, isArriving: boolean }}
 */
export function calculateETA(distanceMeters, speedKmh = 0) {
  if (typeof distanceMeters !== 'number' || distanceMeters < 0) {
    return { etaText: '--', etaMinutes: null, distanceText: '--', isArriving: false };
  }

  // Format human-readable distance
  const distanceText =
    distanceMeters < 1000
      ? `${Math.round(distanceMeters)} m`
      : `${(distanceMeters / 1000).toFixed(1)} km`;

  // Close proximity check
  if (distanceMeters <= 40) {
    return {
      etaText: 'Arriving now',
      etaMinutes: 0,
      distanceText,
      isArriving: true
    };
  }

  // Realistic campus cruising speed (blends real speed with 20 km/h baseline)
  const effectiveSpeedKmh = speedKmh > 10 ? speedKmh * 0.6 + 20 * 0.4 : 18;
  const speedMetersPerSec = (effectiveSpeedKmh * 1000) / 3600;

  // Travel time + 20 seconds buffer for deceleration/signals
  const totalSeconds = distanceMeters / speedMetersPerSec + 20;

  if (totalSeconds <= 50) {
    return {
      etaText: 'Arriving now',
      etaMinutes: 0,
      distanceText,
      isArriving: true
    };
  }

  if (totalSeconds < 90) {
    return {
      etaText: '< 1 min',
      etaMinutes: 1,
      distanceText,
      isArriving: false
    };
  }

  const mins = Math.max(1, Math.round(totalSeconds / 60));
  return {
    etaText: `~${mins} min`,
    etaMinutes: mins,
    distanceText,
    isArriving: false
  };
}

/**
 * High-level helper to calculate full Next-Stop & ETA details for a bus
 * @param {object} bus - Bus object with { location: { lat, lng, speed_kmh }, status }
 * @param {Array} stops - List of stops for the bus's route
 * @returns {object | null} ETA payload
 */
export function getBusETA(bus, stops = []) {
  if (!bus?.location?.lat || !bus?.location?.lng) {
    return null;
  }

  if (bus.status === 'OFFLINE') {
    return {
      nextStop: null,
      etaText: 'Offline',
      distanceText: '--',
      isArriving: false,
      isOffline: true
    };
  }

  const { nextStop, distanceMeters } = findNextStop(bus.location, stops);
  if (!nextStop) return null;

  const eta = calculateETA(distanceMeters, bus.location.speed_kmh);

  return {
    nextStop,
    distanceMeters,
    ...eta,
    isOffline: false
  };
}
