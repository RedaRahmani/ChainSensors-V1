// src/common/fake-locations.ts
export interface FakeLocation {
  name: string;
  latitude: number;
  longitude: number;
  city: string;
  country: string;
}

export const FAKE_LOCATIONS: FakeLocation[] = [
  // Major US Cities
  { name: "Downtown San Francisco", latitude: 37.7749, longitude: -122.4194, city: "San Francisco", country: "USA" },
  { name: "Manhattan, New York", latitude: 40.7831, longitude: -73.9712, city: "New York", country: "USA" },
  { name: "Hollywood, Los Angeles", latitude: 34.0928, longitude: -118.3287, city: "Los Angeles", country: "USA" },
  { name: "Downtown Chicago", latitude: 41.8781, longitude: -87.6298, city: "Chicago", country: "USA" },
  { name: "South Beach, Miami", latitude: 25.7617, longitude: -80.1918, city: "Miami", country: "USA" },
  { name: "Capitol Hill, Seattle", latitude: 47.6205, longitude: -122.3212, city: "Seattle", country: "USA" },
  { name: "Downtown Austin", latitude: 30.2672, longitude: -97.7431, city: "Austin", country: "USA" },
  { name: "Back Bay, Boston", latitude: 42.3601, longitude: -71.0589, city: "Boston", country: "USA" },

  // European Cities
  { name: "Tower Bridge, London", latitude: 51.5074, longitude: -0.0761, city: "London", country: "UK" },
  { name: "Champs-Élysées, Paris", latitude: 48.8738, longitude: 2.2950, city: "Paris", country: "France" },
  { name: "Brandenburg Gate, Berlin", latitude: 52.5163, longitude: 13.3777, city: "Berlin", country: "Germany" },
  { name: "Colosseum, Rome", latitude: 41.8902, longitude: 12.4922, city: "Rome", country: "Italy" },
  { name: "Dam Square, Amsterdam", latitude: 52.3676, longitude: 4.9041, city: "Amsterdam", country: "Netherlands" },
  { name: "Sagrada Familia, Barcelona", latitude: 41.4036, longitude: 2.1744, city: "Barcelona", country: "Spain" },
  { name: "Old Town, Prague", latitude: 50.0755, longitude: 14.4378, city: "Prague", country: "Czech Republic" },

  // Asian Cities
  { name: "Shibuya Crossing, Tokyo", latitude: 35.6762, longitude: 139.6503, city: "Tokyo", country: "Japan" },
  { name: "Marina Bay, Singapore", latitude: 1.2804, longitude: 103.8609, city: "Singapore", country: "Singapore" },
  { name: "Gangnam District, Seoul", latitude: 37.5172, longitude: 127.0473, city: "Seoul", country: "South Korea" },
  { name: "Central, Hong Kong", latitude: 22.2783, longitude: 114.1747, city: "Hong Kong", country: "Hong Kong" },
  { name: "Bund, Shanghai", latitude: 31.2397, longitude: 121.4993, city: "Shanghai", country: "China" },
  { name: "Connaught Place, New Delhi", latitude: 28.6315, longitude: 77.2167, city: "New Delhi", country: "India" },

  // Australian & Canadian Cities
  { name: "Sydney Opera House", latitude: -33.8568, longitude: 151.2153, city: "Sydney", country: "Australia" },
  { name: "Federation Square, Melbourne", latitude: -37.8176, longitude: 144.9685, city: "Melbourne", country: "Australia" },
  { name: "CN Tower, Toronto", latitude: 43.6426, longitude: -79.3871, city: "Toronto", country: "Canada" },
  { name: "Gastown, Vancouver", latitude: 49.2827, longitude: -123.1207, city: "Vancouver", country: "Canada" },

  // South American Cities
  { name: "Copacabana Beach, Rio", latitude: -22.9068, longitude: -43.1729, city: "Rio de Janeiro", country: "Brazil" },
  { name: "Palermo, Buenos Aires", latitude: -34.5755, longitude: -58.4203, city: "Buenos Aires", country: "Argentina" },
  { name: "Miraflores, Lima", latitude: -12.1203, longitude: -77.0286, city: "Lima", country: "Peru" },

  // African Cities  
  { name: "V&A Waterfront, Cape Town", latitude: -33.9249, longitude: 18.4241, city: "Cape Town", country: "South Africa" },
  { name: "Zamalek, Cairo", latitude: 30.0618, longitude: 31.2194, city: "Cairo", country: "Egypt" },

  // Middle Eastern Cities
  { name: "Downtown Dubai", latitude: 25.1972, longitude: 55.2744, city: "Dubai", country: "UAE" },
  { name: "Mamilla, Jerusalem", latitude: 31.7767, longitude: 35.2266, city: "Jerusalem", country: "Israel" },
];

/**
 * Get a consistent fake location for a device based on its ID
 * This ensures the same device always gets the same fake location
 */
export function getFakeLocationForDevice(deviceId: string): FakeLocation {
  // Use device ID to create a consistent hash/index
  let hash = 0;
  for (let i = 0; i < deviceId.length; i++) {
    const char = deviceId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use absolute value to ensure positive index
  const index = Math.abs(hash) % FAKE_LOCATIONS.length;
  return FAKE_LOCATIONS[index];
}

/**
 * Get a random fake location for new devices
 */
export function getRandomFakeLocation(): FakeLocation {
  const index = Math.floor(Math.random() * FAKE_LOCATIONS.length);
  return FAKE_LOCATIONS[index];
}

/**
 * Check if location data looks valid (has lat/lon with reasonable values)
 */
export function isValidLocation(location: any): boolean {
  if (!location || typeof location !== 'object') return false;
  
  const lat = Number(location.latitude);
  const lon = Number(location.longitude);
  
  return (
    Number.isFinite(lat) && 
    Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 &&
    lon >= -180 && lon <= 180
  );
}

/**
 * Ensure a location exists and is valid, using fake location as fallback
 */
export function ensureValidLocation(
  location: any, 
  deviceId: string
): { latitude: number; longitude: number; name?: string } {
  if (isValidLocation(location)) {
    return {
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      name: location.name
    };
  }
  
  // Use consistent fake location based on device ID
  const fakeLocation = getFakeLocationForDevice(deviceId);
  return {
    latitude: fakeLocation.latitude,
    longitude: fakeLocation.longitude,
    name: fakeLocation.name
  };
}
