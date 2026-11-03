import { useEffect, useState } from 'react';
import { SCHOOLS } from '../config';
import { AsyncStorage } from './native';

/* Shared fetch pattern for callables: honest loading/error, never a
   silent failure. `asArray` coerces list endpoints to []. */
/* Reads that are safe to keep a copy of on this phone, so Flyer still
   shows something useful offline (in a basement classroom, on a bad
   signal). Never anything private to other people. */
const OFFLINE_OK = new Set(['getNews', 'getEvents', 'getDeals', 'getAround', 'getCampusAlerts', 'getSportsSchedule', 'getDegreePlan', 'getMajor', 'getSponsors', 'getVenueImage', 'getPlay', 'getLeaderboard']);
const CACHE_PREFIX = 'flyer.cache.';
const memCache = {};
async function readCache(k) {
  if (memCache[k]) return memCache[k];
  try { const raw = AsyncStorage ? await AsyncStorage.getItem(CACHE_PREFIX + k) : null; if (raw) { memCache[k] = JSON.parse(raw); return memCache[k]; } } catch (e) { /* ignore */ }
  return null;
}
function writeCache(k, data) {
  const v = { data, at: Date.now() };
  memCache[k] = v;
  try { if (AsyncStorage) AsyncStorage.setItem(CACHE_PREFIX + k, JSON.stringify(v)).catch(() => {}); } catch (e) { /* ignore */ }
}
/** Clears every offline copy (sign out, delete account). */
export async function clearOfflineCache() {
  Object.keys(memCache).forEach((k) => delete memCache[k]);
  try {
    if (!AsyncStorage) return;
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(CACHE_PREFIX)));
  } catch (e) { /* ignore */ }
}

export function useCallable(fn, params, key, { asArray = true, enabled = true } = {}) {
  const paramsKey = JSON.stringify(params || {});
  const cacheKey = fn && fn.callableName && OFFLINE_OK.has(fn.callableName) ? `${fn.callableName}:${paramsKey}:${key || ''}` : null;
  const [state, setState] = useState({ data: null, loading: enabled, error: null, offline: false, savedAt: null });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!enabled) { setState({ data: null, loading: false, error: null, offline: false, savedAt: null }); return undefined; }
    let cancelled = false;
    let fresh = false;
    setState((p) => ({ ...p, loading: true, error: null }));
    const shape = (v) => (asArray ? (Array.isArray(v) ? v : []) : (v ?? null));
    // Show the saved copy right away while the fresh one loads.
    if (cacheKey) {
      readCache(cacheKey).then((c) => {
        if (cancelled || fresh || !c) return;
        setState((p) => (p.data == null ? { data: shape(c.data), loading: true, error: null, offline: false, savedAt: c.at } : p));
      });
    }
    fn(params)
      .then((res) => {
        fresh = true;
        if (cancelled) return;
        const v = res && res.data && (key ? res.data[key] : res.data);
        if (cacheKey) writeCache(cacheKey, v);
        setState({ data: shape(v), loading: false, error: null, offline: false, savedAt: null });
      })
      .catch(async (e) => {
        fresh = true;
        if (cancelled) return;
        const msg = e?.code === 'functions/resource-exhausted' ? e.message : (e?.message || 'Failed to load.');
        const c = cacheKey ? await readCache(cacheKey) : null;
        if (cancelled) return;
        if (c) setState({ data: shape(c.data), loading: false, error: null, offline: true, savedAt: c.at });
        else setState({ data: null, loading: false, error: msg, offline: false, savedAt: null });
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
  if (f.code >= 95) return `Storms around then (${f.temp}°). Give yourself extra time.`;
  if (f.rain >= 40) return `${f.rain}% chance of rain. Grab an umbrella.`;
  if (f.temp <= 45) return `It'll be ${f.temp}°. Bring a jacket.`;
  if (f.temp >= 97) return `It'll be ${f.temp}°. Bring water.`;
  return null;
}

export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), intervalMs); return () => clearInterval(id); }, [intervalMs]);
  return now;
}
