/**
 * Simulated bus movement engine for Campus Connect (Pondicherry University Campus)
 * Used when VITE_MOCK_TRACKING=true, during simulation test mode, or when no physical driver is live.
 */

// Pondicherry University Campus Loop Route 1 (Main Gate 1 -> Silver Jubilee Campus)
export const PU_ROUTE_1_WAYPOINTS = [
  { lat: 12.019596, lng: 79.859077, heading: 275 }, // University Main Gate 1
  { lat: 12.020898, lng: 79.855204, heading: 285 }, // Reading Room/MBA Department
  { lat: 12.017508, lng: 79.853592, heading: 200 }, // DODE & Shopping Complex
  { lat: 12.019434, lng: 79.850250, heading: 290 }, // Health Care Center
  { lat: 12.021689, lng: 79.849130, heading: 345 }, // Ganga Girls Hostel
  { lat: 12.022298, lng: 79.847990, heading: 300 }, // Mother Teresa Mess
  { lat: 12.022996, lng: 79.847145, heading: 310 }, // Narmada Hostel
  { lat: 12.024014, lng: 79.846627, heading: 330 }, // Kannagi Hostel
  { lat: 12.026560, lng: 79.847402, heading: 15 },  // Open Air Theatre
  { lat: 12.028648, lng: 79.848145, heading: 15 },  // SRK Hostel
  { lat: 12.029502, lng: 79.848864, heading: 45 },  // Maka Hostel
  { lat: 12.029689, lng: 79.850907, heading: 85 },  // Amudham Mess
  { lat: 12.028902, lng: 79.852812, heading: 120 }, // Mega Mess
  { lat: 12.028421, lng: 79.853046, heading: 110 }, // Ilango Adigal Hostel
  { lat: 12.027551, lng: 79.853500, heading: 135 }, // CV Raman
  { lat: 12.028450, lng: 79.855478, heading: 60 },  // Food Science Department
  { lat: 12.032192, lng: 79.856872, heading: 20 },  // Electronic Media & Mass Comm
  { lat: 12.033146, lng: 79.857535, heading: 30 },  // Silver Jubilee Campus
];

// Pondicherry University Route 2 (Silver Jubilee Campus -> Library -> Gate 1)
export const PU_ROUTE_2_WAYPOINTS = [
  { lat: 12.033146, lng: 79.857535, heading: 200 }, // Silver Jubilee Campus
  { lat: 12.032192, lng: 79.856872, heading: 210 }, // Electronic Media & Mass Comm
  { lat: 12.028450, lng: 79.855478, heading: 240 }, // Food Science Department
  { lat: 12.027551, lng: 79.853500, heading: 315 }, // CV Raman
  { lat: 12.028421, lng: 79.853046, heading: 290 }, // Ilango Adigal Hostel
  { lat: 12.028902, lng: 79.852812, heading: 300 }, // Mega Mess
  { lat: 12.029689, lng: 79.850907, heading: 265 }, // Amudham Mess
  { lat: 12.029502, lng: 79.848864, heading: 225 }, // Maka Hostel
  { lat: 12.028648, lng: 79.848145, heading: 195 }, // SRK Hostel
  { lat: 12.026560, lng: 79.847402, heading: 195 }, // Open Air Theatre
  { lat: 12.024027, lng: 79.846717, heading: 150 }, // Kannagi Hostel
  { lat: 12.023131, lng: 79.847185, heading: 130 }, // Kalpana Chawla Hostel
  { lat: 12.022422, lng: 79.847967, heading: 120 }, // Madame Curie Hostel
  { lat: 12.021954, lng: 79.849102, heading: 110 }, // Ganga Hostel
  { lat: 12.019284, lng: 79.850438, heading: 110 }, // Health Center
  { lat: 12.017663, lng: 79.853533, heading: 20 },  // DODE & Shopping Complex
  { lat: 12.021037, lng: 79.855186, heading: 105 }, // Reading Room/MBA
  { lat: 12.020583, lng: 79.856519, heading: 100 }, // Library
  { lat: 12.019548, lng: 79.859607, heading: 95 }   // Gate 1 Bus-Stop
];

// Persistent internal step counter per bus
const busStepTracker = new Map();

/**
 * Returns the next simulated step for a bus along its designated route
 * @param {string} busId 
 * @param {string} [routeName]
 * @returns {object} Mock location payload
 */
export function getNextMockLocation(busId, routeName = 'Route 1 Gate-2 - SJ Campus') {
  const isRoute2 = routeName && (routeName.includes('2') || routeName.toLowerCase().includes('library'));
  const waypoints = isRoute2 ? PU_ROUTE_2_WAYPOINTS : PU_ROUTE_1_WAYPOINTS;

  let currentStep = busStepTracker.get(busId) || 0;
  const point = waypoints[currentStep % waypoints.length];

  // Advance step for next tick
  busStepTracker.set(busId, currentStep + 1);

  // Slight micro-jitter for realism (within ~5 meters)
  const jitterLat = (Math.random() - 0.5) * 0.00008;
  const jitterLng = (Math.random() - 0.5) * 0.00008;
  const speed = 20 + Math.floor(Math.random() * 12); // 20-32 km/h

  return {
    lat: Number((point.lat + jitterLat).toFixed(6)),
    lng: Number((point.lng + jitterLng).toFixed(6)),
    heading: point.heading,
    speed_kmh: speed,
    is_mock: true,
    updated_at: new Date().toISOString()
  };
}
