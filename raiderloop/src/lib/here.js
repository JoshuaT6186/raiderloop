/**
 * The student's current position, for walk times only. Never asks for
 * permission (that's the location settings' job) and never leaves the
 * phone. Refreshed when a screen that shows walk times opens and when
 * the app comes back to the foreground, at most every 30 seconds.
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { currentPosition } from './location';
import { getHere, setHere } from '../data/campus';

let lastFetch = 0;
let inflight = null;

export async function refreshHere(force = false) {
  if (!force && getHere() && Date.now() - lastFetch < 30000) return getHere();
  if (inflight) return inflight;
  lastFetch = Date.now();
  inflight = currentPosition().then((p) => { if (p) setHere(p); return getHere(); }).catch(() => getHere()).finally(() => { inflight = null; });
  return inflight;
}

export function useHere() {
  const [pos, setPos] = useState(getHere());
  useEffect(() => {
    let alive = true;
    const go = () => refreshHere().then((p) => { if (alive) setPos(p); });
    go();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') go(); });
    return () => { alive = false; sub.remove(); };
  }, []);
  return pos;
}
