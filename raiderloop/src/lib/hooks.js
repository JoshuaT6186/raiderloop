import { useEffect, useState } from 'react';
import { SCHOOLS } from '../config';

/* Shared fetch pattern for callables: honest loading/error, never a
   silent failure. `asArray` coerces list endpoints to []. */
export function useCallable(fn, params, key, { asArray = true, enabled = true } = {}) {
  const paramsKey = JSON.stringify(params || {});
  const [state, setState] = useState({ data: null, loading: enabled, error: null });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!enabled) { setState({ data: null, loading: false, error: null }); return undefined; }
    let cancelled = false;
    setState((p) => ({ ...p, loading: true, error: null }));
    fn(params)
      .then((res) => {
        if (cancelled) return;
        const v = res && res.data && (key ? res.data[key] : res.data);
        setState({ data: asArray ? (Array.isArray(v) ? v : []) : (v ?? null), loading: false, error: null });
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e?.code === 'functions/resource-exhausted' ? e.message : (e?.message || 'Failed to load.');
        setState({ data: null, loading: false, error: msg });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, nonce, enabled]);
  return { ...state, reload: () => setNonce((n) => n + 1) };
}

/* ---------- Weather (Open-Meteo, free, no key) ---------- */
export function weatherCodeToCondition(code) {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Mostly sunny';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow showers';
  if (code >= 95) return 'Thunderstorms';
  return 'Clear';
}
export function weatherIcon(code, isDay = true) {
  if (code == null) return 'sun';
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 51) return 'rain';
  if (code >= 3) return 'cloud';
  return isDay ? 'sun' : 'moon';
}

export async function fetchWeather(schoolId = 'ttu') {
  const c = (SCHOOLS.find((s) => s.id === schoolId) || SCHOOLS[0]).center;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.latitude}&longitude=${c.longitude}`
    + '&current=temperature_2m,weather_code,is_day&hourly=temperature_2m,precipitation_probability,weather_code'
    + '&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=America%2FChicago&forecast_days=2';
  const r = await fetch(url);
  const data = await r.json();
  if (!data || !data.current) throw new Error('no weather');
  const hourly = (data.hourly?.time || []).map((time, i) => ({
    time, temp: Math.round(data.hourly.temperature_2m[i]), rain: data.hourly.precipitation_probability?.[i] ?? 0, code: data.hourly.weather_code[i],
  }));
  return {
    temp: Math.round(data.current.temperature_2m), code: data.current.weather_code, isDay: !!data.current.is_day,
    condition: weatherCodeToCondition(data.current.weather_code),
    hi: Math.round(data.daily?.temperature_2m_max?.[0]), lo: Math.round(data.daily?.temperature_2m_min?.[0]), hourly,
  };
}

let weatherCache = null; let weatherAt = 0;
export function useWeather(schoolId) {
  const [state, setState] = useState(() => (weatherCache ? { ...weatherCache, loading: false, error: false } : { loading: true, error: false }));
  useEffect(() => {
    let cancelled = false;
    if (weatherCache && Date.now() - weatherAt < 15 * 60000) return undefined;
    fetchWeather(schoolId)
      .then((w) => { weatherCache = w; weatherAt = Date.now(); if (!cancelled) setState({ ...w, loading: false, error: false }); })
      .catch(() => { if (!cancelled) setState((p) => ({ ...p, loading: false, error: true })); });
    return () => { cancelled = true; };
  }, [schoolId]);
  return state;
}

/** Forecast at a given Date from hourly data (nearest hour). */
export function forecastAt(hourly, date) {
  if (!hourly || !hourly.length) return null;
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:00`;
  return hourly.find((h) => h.time === key) || null;
}

/** A short, useful heads-up for walking to class — or null. */
export function weatherNote(f) {
  if (!f) return null;
  if (f.code >= 95) return `Storms around then (${f.temp}°) — give yourself extra time.`;
  if (f.rain >= 40) return `${f.rain}% chance of rain — grab an umbrella.`;
  if (f.temp <= 45) return `It'll be ${f.temp}° — bring a jacket.`;
  if (f.temp >= 97) return `It'll be ${f.temp}° — bring water.`;
  return null;
}

export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), intervalMs); return () => clearInterval(id); }, [intervalMs]);
  return now;
}
