'use client';

import { useEffect, useState } from 'react';

/**
 * useWeather.ts
 * -------------
 * Ported from the standalone Atlas prototype (src/hooks/useWeather.js).
 * Live current-weather lookup for a district's centroid using Open-Meteo
 * — free, no API key/signup, CORS-enabled for direct browser calls.
 */

const WMO_LABELS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow',
  80: 'Rain showers',
  95: 'Thunderstorm',
};

export interface WeatherData {
  tempC: number;
  humidity: number;
  windKph: number;
  label: string;
}

type WeatherState =
  | { status: 'idle'; data: null; error: null }
  | { status: 'loading'; data: null; error: null }
  | { status: 'error'; data: null; error: string }
  | { status: 'ready'; data: WeatherData; error: null };

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
}

export function useWeather(lngLat: [number, number] | null) {
  const [state, setState] = useState<WeatherState>({ status: 'idle', data: null, error: null });

  useEffect(() => {
    if (!lngLat) return undefined;
    const [lng, lat] = lngLat;
    let cancelled = false;

    setState({ status: 'loading', data: null, error: null });

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(
      3,
    )}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Weather service unavailable');
        return res.json() as Promise<OpenMeteoResponse>;
      })
      .then((json) => {
        if (cancelled) return;
        const c = json.current;
        if (!c || c.temperature_2m === undefined) throw new Error('Weather response missing current conditions');
        setState({
          status: 'ready',
          error: null,
          data: {
            tempC: c.temperature_2m,
            humidity: c.relative_humidity_2m ?? 0,
            windKph: c.wind_speed_10m ?? 0,
            label: (c.weather_code !== undefined && WMO_LABELS[c.weather_code]) || 'Conditions unavailable',
          },
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', data: null, error: err instanceof Error ? err.message : 'Network error' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [lngLat]);

  return state;
}
