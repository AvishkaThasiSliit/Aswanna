/**
 * Geographic and Logistics Calculation Utilities
 */

// Earth radius in kilometers
const EARTH_RADIUS_KM = 6371;

/**
 * Calculate Great-Circle distance using Haversine formula
 */
export function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const toRad = (val) => (val * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Estimate Sri Lankan road distance from straight-line Haversine
 * Sri Lankan terrain winding factor is typically 1.25 - 1.35x
 */
export function estimateRoadDistanceKm(haversineKm) {
  if (!haversineKm) return 0;
  return Math.round(haversineKm * 1.28 * 10) / 10;
}

/**
 * Estimate travel time in hours/minutes given distance in km
 * Average rural/hill-country commercial produce speed: ~38 km/h
 */
export function estimateTravelTime(distanceKm) {
  if (!distanceKm || distanceKm <= 0) return '0 min';
  const hours = distanceKm / 38;
  const totalMins = Math.round(hours * 60);
  if (totalMins < 60) return `${totalMins} mins`;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Preview transport freight cost (Round trip: farm -> centre -> farm)
 */
export function calculateTransportPreview({ distanceKm, kmPerL = 17, fuelPrice = 315 }) {
  if (!distanceKm || !kmPerL || kmPerL <= 0) return 0;
  const roundTripDistance = distanceKm * 2;
  const fuelLiters = roundTripDistance / kmPerL;
  return Math.round(fuelLiters * fuelPrice);
}
