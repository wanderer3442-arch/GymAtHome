'use client';

import { useState, useEffect } from 'react';
import { Sun, AlertCircle, Droplet, Wind, Clock } from 'lucide-react';

// --- Weather Data Interface ---
interface WeatherData {
  temperature: number;
  condition: string;
  conditionIcon: string;
  humidity: number;
  windSpeed: number; // m/s
  location: string; // City name or "Your Location"
  feelsLike: number;
  uvIndex: number;
  sunrise: string;
  sunset: string;
  visibility: number; // meters
  precipitation: number; // mm per hour
  latitude?: number;
  longitude?: number;
}

// --- Configuration ---
// Real weather via Open-Meteo (https://open-meteo.com) - free, open, and
// NO API KEY REQUIRED. We send the phone's GPS coordinates and get real
// conditions back. Only falls back to mock data if the request fails or the
// user denies location permission.

// --- Real API: Open-Meteo ---
// Simple in-memory cache so repeated useWeather calls (same coordinates) don't
// issue duplicate requests.
const weatherCache = new Map<string, { data: WeatherData; at: number }>();
const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;
const inFlight = new Map<string, Promise<WeatherData | null>>();

function fetchWeatherOnce(lat: number, lng: number): Promise<WeatherData | null> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.at < WEATHER_CACHE_TTL_MS) {
    return Promise.resolve(cached.data);
  }
  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = fetchRealWeatherByCoords(lat, lng).then((data) => {
    inFlight.delete(key);
    if (data) weatherCache.set(key, { data, at: Date.now() });
    return data;
  });
  inFlight.set(key, request);
  return request;
}

/**
 * Read-only peek at the freshest cached temperature - issues no fetch and
 * prompts no permission. Returns null when nothing fresh is cached. Used by
 * the notification timing engine for hot-day hydration nudges.
 */
export function peekCachedTemperature(): number | null {
  let freshest: { data: WeatherData; at: number } | null = null;
  for (const entry of weatherCache.values()) {
    if (!freshest || entry.at > freshest.at) freshest = entry;
  }
  if (!freshest || Date.now() - freshest.at > WEATHER_CACHE_TTL_MS) return null;
  return freshest.data.temperature;
}

// Map a WMO weather code to a readable condition + emoji icon.
function getWmoCondition(code: number): { condition: string; icon: string } {
  const map: Record<number, { condition: string; icon: string }> = {
    0: { condition: 'Clear', icon: '☀️' },
    1: { condition: 'Mainly Clear', icon: '🌤️' },
    2: { condition: 'Partly Cloudy', icon: '⛅' },
    3: { condition: 'Cloudy', icon: '☁️' },
    45: { condition: 'Fog', icon: '🌫️' },
    48: { condition: 'Fog', icon: '🌫️' },
    51: { condition: 'Drizzle', icon: '🌦️' },
    53: { condition: 'Drizzle', icon: '🌦️' },
    55: { condition: 'Drizzle', icon: '🌦️' },
    56: { condition: 'Freezing Drizzle', icon: '🌧️' },
    57: { condition: 'Freezing Drizzle', icon: '🌧️' },
    61: { condition: 'Rain', icon: '🌧️' },
    63: { condition: 'Rain', icon: '🌧️' },
    65: { condition: 'Heavy Rain', icon: '🌧️' },
    66: { condition: 'Freezing Rain', icon: '🌧️' },
    67: { condition: 'Freezing Rain', icon: '🌧️' },
    71: { condition: 'Snow', icon: '❄️' },
    73: { condition: 'Snow', icon: '❄️' },
    75: { condition: 'Heavy Snow', icon: '❄️' },
    77: { condition: 'Snow Grains', icon: '❄️' },
    80: { condition: 'Rain Showers', icon: '🌦️' },
    81: { condition: 'Rain Showers', icon: '🌧️' },
    82: { condition: 'Heavy Showers', icon: '🌧️' },
    85: { condition: 'Snow Showers', icon: '🌨️' },
    86: { condition: 'Snow Showers', icon: '🌨️' },
    95: { condition: 'Thunderstorm', icon: '⛈️' },
    96: { condition: 'Thunderstorm', icon: '⛈️' },
    99: { condition: 'Thunderstorm', icon: '⛈️' },
  };
  return map[code] || { condition: 'Partly Cloudy', icon: '🌤️' };
}

// Format an ISO local time ("2026-10-22T06:26") as "6:26 AM".
function formatLocalTime(iso: string | undefined): string {
  if (!iso) return '--';
  const timePart = iso.split('T')[1];
  if (!timePart) return '--';
  const [hStr, mStr] = timePart.split(':');
  const hour = parseInt(hStr, 10);
  const minute = mStr || '00';
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${minute} ${ampm}`;
}

// Gets current weather from Open-Meteo using the phone's GPS coordinates.
async function fetchRealWeatherByCoords(
  lat: number,
  lng: number
): Promise<WeatherData | null> {
  try {
    // current = present conditions; hourly uv_index for the current hour;
    // daily sunrise/sunset for today. timezone=auto uses the phone's zone.
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m` +
      `&hourly=uv_index` +
      `&daily=sunrise,sunset` +
      `&timezone=auto&forecast_days=1`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();
    const current = data.current;
    const wmo = getWmoCondition(current.weather_code);

    // UV index for the current hour (hourly array is aligned to local time).
    let uvIndex = 5;
    if (data.hourly?.uv_index && data.hourly?.time && current?.time) {
      const idx = data.hourly.time.indexOf(current.time);
      if (idx >= 0 && typeof data.hourly.uv_index[idx] === 'number') {
        uvIndex = Math.round(data.hourly.uv_index[idx] * 10) / 10;
      }
    }

    const weather: WeatherData = {
      temperature: Math.round(current.temperature_2m),
      condition: wmo.condition,
      conditionIcon: wmo.icon,
      humidity: Math.round(current.relative_humidity_2m),
      // API returns km/h; interface stores m/s.
      windSpeed: Math.round((current.wind_speed_10m / 3.6) * 10) / 10,
      location: `Coordinates (${lat.toFixed(2)}, ${lng.toFixed(2)})`,
      feelsLike: Math.round(current.apparent_temperature),
      uvIndex,
      sunrise: formatLocalTime(data.daily?.sunrise?.[0]),
      sunset: formatLocalTime(data.daily?.sunset?.[0]),
      visibility: 10000,
      precipitation: current.precipitation || 0,
      latitude: lat,
      longitude: lng,
    };

    return weather;
  } catch (error) {
    console.error('Open-Meteo API error:', error);
    return null;
  }
}

// Mock weather data - used as fallback
const mockWeatherData: WeatherData = {
  temperature: 24,
  condition: 'Partly Cloudy',
  conditionIcon: '☁️',
  humidity: 65,
  windSpeed: 8,
  location: 'Your Location',
  feelsLike: 26,
  uvIndex: 5,
  sunrise: '6:42 AM',
  sunset: '7:18 PM',
  visibility: 10000,
  precipitation: 0,
};

// --- Geolocation (shared singleton) ---
// useWeather('auto') may be mounted in several places at once. Without a
// shared singleton each mount would fire its own getCurrentPosition +
// watchPosition (duplicate permission requests and watchers). This
// module-level store runs the browser API once and fans the result out to
// every subscriber.
type GeoState = {
  location: { lat: number; lng: number } | null;
  error: string | null;
};

let geoState: GeoState = { location: null, error: null };
const geoListeners = new Set<(state: GeoState) => void>();
let geoStarted = false;

function emitGeoState() {
  geoListeners.forEach((listener) => listener(geoState));
}

function startGeolocationOnce() {
  if (geoStarted) return;
  geoStarted = true;

  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    geoState = { location: null, error: 'Geolocation not supported on this device' };
    emitGeoState();
    return;
  }

  const success = (position: GeolocationPosition) => {
    geoState = {
      location: {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      },
      error: null,
    };
    emitGeoState();
  };

  const failure = (err: GeolocationPositionError) => {
    console.error('Geolocation error:', err);
    geoState = {
      location: null,
      error:
        err.code === err.PERMISSION_DENIED
          ? 'Permission denied for geolocation'
          : 'Unable to retrieve location',
    };
    emitGeoState();
  };

  const options: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 60000,
  };

  navigator.geolocation.getCurrentPosition(success, failure, options);
  navigator.geolocation.watchPosition(success, failure, options);
}

function useGeolocation(): GeoState {
  const [state, setState] = useState<GeoState>(geoState);

  useEffect(() => {
    startGeolocationOnce();
    const listener = (next: GeoState) => setState(next);
    geoListeners.add(listener);
    // Re-sync in case the location resolved before this component subscribed.
    setState(geoState);
    return () => {
      geoListeners.delete(listener);
    };
  }, []);

  return state;
}

// --- Mock Data (Fallback) ---
// Deterministic: same coordinates always produce the same mock weather
function hashCode(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const getMockWeatherForLocation = (lat: number, lng: number): WeatherData => {
  // Deterministic pseudo-random based on rounded coordinates
  const seed = hashCode(`${lat.toFixed(1)},${lng.toFixed(1)}`);
  const rand = (min: number, max: number) =>
    min + ((seed >> (min % 17)) % 1000) / 1000 * (max - min);

  const baseTemp = Math.round(20 + (Math.abs(lat) % 30));
  const conditions = ['Clear', 'Clouds', 'Rain', 'Snow', 'Fog'];
  const condition = conditions[seed % conditions.length];
  const humidity = Math.round(40 + rand(0, 50));
  const windSpeed = Math.round(5 + rand(0, 15));

  const conditionIcons: Record<string, string> = {
    Clear: '☀️',
    Clouds: '☁️',
    Rain: '🌧️',
    Snow: '❄️',
    Fog: '🌫️',
  };

  return {
    temperature: baseTemp,
    condition,
    conditionIcon: conditionIcons[condition] || '🌈',
    humidity,
    windSpeed,
    location: `Coordinates (${lat.toFixed(2)}, ${lng.toFixed(2)})`,
    feelsLike: baseTemp + 2,
    uvIndex: Math.round(5 + rand(0, 5)),
    sunrise: '6:42 AM',
    sunset: '7:18 PM',
    visibility: 10000,
    precipitation: 0,
    latitude: lat,
    longitude: lng,
  };
};

// --- Hook ---
export function useWeather(
  location: string = 'auto'
): {
  weather: WeatherData | null;
  loading: boolean;
  error: string | null;
  geolocation: { lat: number; lng: number } | null;
  locationError: string | null;
} {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { location: geoLocation, error: geoError } = useGeolocation();

  useEffect(() => {
    let cancelled = false;

    const fetchWeather = async () => {
      setLoading(true);
      setError(null);

      try {
        // Priority 1: Use phone geolocation if available and user hasn't provided a specific location
        if (geoLocation && location === 'auto') {
          // Real weather from Open-Meteo using the phone's GPS - no API key.
          const realWeather = await fetchWeatherOnce(
            geoLocation.lat,
            geoLocation.lng
          );
          if (realWeather) {
            if (!cancelled) {
              setWeather(realWeather);
              setLoading(false);
            }
            return;
          }

          // Fallback: deterministic mock data with real coordinates.
          if (!cancelled) {
            const mockWeather = getMockWeatherForLocation(
              geoLocation.lat,
              geoLocation.lng
            );
            setWeather(mockWeather);
            setLoading(false);
          }
        } else {
          // User provided a specific location string or using 'auto' without geolocation
          // Use mock data with generic location
          if (!cancelled) {
            setWeather(mockWeatherData);
            setLoading(false);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError('Unable to fetch weather data');
          console.error('Weather fetch error:', err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchWeather();

    return () => {
      cancelled = true;
    };
  }, [location, geoLocation]);

  return {
    weather,
    loading,
    error,
    geolocation: geoLocation || null,
    locationError: geoError,
  };
}

// --- Widget Component ---
export function WeatherWidget({ location: propLocation = 'auto' }: { location?: string }) {
  const {
    weather,
    loading,
    error,
    geolocation,
    locationError,
  } = useWeather(propLocation);

  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-gradient-to-br from-surface-container to-surface border border-outline-variant/30 shadow-sm text-center">
        <Sun className="w-10 h-10 mx-auto text-primary mb-3 animate-pulse" />
        <p className="text-sm text-on-surface-variant">Getting weather for your location...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-gradient-to-br from-surface-container to-surface border border-outline-variant/30 shadow-sm text-center">
        <AlertCircle className="w-10 h-10 mx-auto text-error mb-3" />
        <p className="text-sm text-error">Weather unavailable</p>
      </div>
    );
  }

  if (!weather) return null;

  // Prefer the resolved GPS location; fall back to whatever the API/mock says.
  const displayLocation = geolocation
    ? `GPS ${geolocation.lat.toFixed(2)}, ${geolocation.lng.toFixed(2)}`
    : propLocation === 'auto'
    ? 'Your Location'
    : propLocation;

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-br from-surface-container to-surface border border-outline-variant/30 shadow-sm overflow-hidden">
      {/* Header: temperature + location */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-2xl leading-none" aria-hidden>{weather.conditionIcon}</span>
          <span className="text-2xl font-bold text-primary">{weather.temperature}°</span>
          <span className="text-xs text-on-surface-variant">{weather.condition}</span>
        </div>
        <span className="text-xs text-on-surface-variant truncate max-w-[45%]" title={displayLocation}>
          {displayLocation}
        </span>
      </div>

      {/* Stats: wrap instead of squeezing when the screen is narrow */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <div>
          <p className="text-on-surface-variant">Feels like {weather.feelsLike}°</p>
        </div>
        <div>
          <p className="text-on-surface-variant">{weather.humidity}% Humidity</p>
        </div>
        <div>
          <p className="text-on-surface-variant">{Math.round(weather.windSpeed * 3.6)} km/h Wind</p>
        </div>
      </div>

      {/* Detail row: fixed-size icons, wraps on small screens, never overflows */}
      <div className="mt-3 pt-3 border-t border-outline-variant/20 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        <span className="flex items-center gap-1.5 text-on-surface-variant">
          <Droplet className="w-3.5 h-3.5 shrink-0 opacity-60" />
          <span className="font-medium text-on-surface">{weather.precipitation} mm</span>
        </span>
        <span className="flex items-center gap-1.5 text-on-surface-variant">
          <Wind className="w-3.5 h-3.5 shrink-0 opacity-60" />
          <span className="font-medium text-on-surface">
            {Math.round(weather.windSpeed * 3.6)} km/h
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-on-surface-variant">
          <Clock className="w-3.5 h-3.5 shrink-0 opacity-60" />
          <span className="font-medium text-on-surface whitespace-nowrap">
            {weather.sunrise} – {weather.sunset}
          </span>
        </span>
      </div>

      {/* Surface location problems instead of failing silently */}
      {locationError && (
        <p className="mt-2 text-[11px] text-on-surface-variant/80">
          Location off — enable GPS permission for weather at your exact spot.
        </p>
      )}
    </div>
  );
}
