/**
 * Utility validation routines for Campus Connect
 */

/**
 * Validates standard email address format
 * @param {string} email 
 * @returns {boolean}
 */
export function isEmail(email) {
  if (typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

/**
 * Validates university student registration number
 * Pattern: 2 to 4 uppercase letters followed by 4 to 8 digits (e.g., CS202401, EN1029384)
 * @param {string} regNo 
 * @returns {boolean}
 */
export function isRegNo(regNo) {
  if (typeof regNo !== 'string') return false;
  const re = /^[A-Z]{2,4}\d{4,8}$/;
  return re.test(regNo.trim());
}

/**
 * Validates geographic latitude and longitude coordinates
 * @param {number|string} lat 
 * @param {number|string} lng 
 * @returns {boolean}
 */
export function isCoord(lat, lng) {
  const numLat = Number(lat);
  const numLng = Number(lng);

  if (isNaN(numLat) || isNaN(numLng)) return false;
  if (numLat < -90 || numLat > 90) return false;
  if (numLng < -180 || numLng > 180) return false;

  return true;
}

/**
 * Validates canonical UUID v4 string
 * @param {string} uuid 
 * @returns {boolean}
 */
export function isUuid(uuid) {
  if (typeof uuid !== 'string') return false;
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return re.test(uuid.trim());
}

/**
 * Cleans and trims user input string
 * @param {string} str 
 * @param {number} [maxLen=2000]
 * @returns {string}
 */
export function clean(str, maxLen = 2000) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen);
}
