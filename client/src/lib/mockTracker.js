/**
 * Simulated bus movement engine for Campus Connect (Delhi Campus)
 * Only active when VITE_MOCK_TRACKING=true or when no physical driver is live.
 */

// Delhi campus loop coordinates
export const NORTH_LOOP_WAYPOINTS = [
  { lat: 28.6139, lng: 77.2090, heading: 45 },   // Campus Main Gate
  { lat: 28.6162, lng: 77.2118, heading: 50 },   // Academic Avenue
  { lat: 28.6185, lng: 77.2145, heading: 40 },   // Science & Tech Block
  { lat: 28.6212, lng: 77.2178, heading: 60 },   // Student Activity Center
  { lat: 28.6240, lng: 77.2210, heading: 135 },  // Central Library & Arts
  { lat: 28.6210, lng: 77.2180, heading: 225 },  // North Quad
  { lat: 28.6175, lng: 77.2135, heading: 230 },  // Engineering Quad
  { lat: 28.6150, lng: 77.2105, heading: 220 },  // Admin Circle
];

export const HOSTEL_LINE_WAYPOINTS = [
  { lat: 28.6080, lng: 77.2020, heading: 30 },   // Hostel Complex East
  { lat: 28.6095, lng: 77.2040, heading: 35 },   // Dining Hall
  { lat: 28.6110, lng: 77.2060, heading: 45 },   // Sports Complex Arena
  { lat: 28.6125, lng: 77.2078, heading: 50 },   // Health Center
  { lat: 28.6139, lng: 77.2090, heading: 210 },  // Campus Main Gate Junction
  { lat: 28.6115, lng: 77.2065, heading: 220 },  // Return Avenue
  { lat: 28.6090, lng: 77.2035, heading: 210 },  // South Pathway
];

// Persistent internal step counter per bus
const busStepTracker = new Map();

/**
 * Returns the next simulated step for a bus along its designated route
 * @param {string} busId 
 * @param {string} [routeName]
 * @returns {object} Mock location payload
 */
export function getNextMockLocation(busId, routeName = 'North Loop') {
  const isHostel = routeName && routeName.toLowerCase().includes('hostel');
  const waypoints = isHostel ? HOSTEL_LINE_WAYPOINTS : NORTH_LOOP_WAYPOINTS;

  let currentStep = busStepTracker.get(busId) || 0;
  const point = waypoints[currentStep % waypoints.length];

  // Advance step for next tick
  busStepTracker.set(busId, currentStep + 1);

  // Slight jitter for realism
  const jitterLat = (Math.random() - 0.5) * 0.0001;
  const jitterLng = (Math.random() - 0.5) * 0.0001;
  const speed = 22 + Math.floor(Math.random() * 12); // 22-34 km/h

  return {
    lat: Number((point.lat + jitterLat).toFixed(6)),
    lng: Number((point.lng + jitterLng).toFixed(6)),
    heading: point.heading,
    speed_kmh: speed,
    is_mock: true,
    updated_at: new Date().toISOString()
  };
}
