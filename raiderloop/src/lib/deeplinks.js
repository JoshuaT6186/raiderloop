/**
 * Links into Flyer: flyer://… and https://<share site>/… (universal
 * links). Each becomes an action the Shell knows how to open.
 */
import { SHARE } from '../config';

const KINDS = { s: 'share', c: 'card', g: 'group', d: 'drop', p: 'plan', q: 'queue', t: 'present', e: 'event' };

export function parseLink(url) {
  if (!url) return null;
  let path = '';
  const s = String(url);
  if (s.startsWith('flyer://')) path = s.slice('flyer://'.length);
  else {
    const host = SHARE.base.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const m = s.match(/^https?:\/\/([^/]+)\/(.*)$/);
    if (!m) return null;
    const ok = m[1] === host || (SHARE.altHosts || []).includes(m[1]);
    if (!ok) return null;
    path = m[2];
  }
  path = path.split('#')[0];
  const [pathOnly, qs] = path.split('?');
  const parts = pathOnly.split('/').filter(Boolean);
  if (!parts.length) return null;
  if (parts[0] === 'oauth' || parts[0] === 'canvas-auth' || parts[0] === 'expo-development-client') return null;
  const type = KINDS[parts[0]];
  if (!type || !parts[1]) return null;
  const params = {};
  (qs || '').split('&').filter(Boolean).forEach((kv) => { const [k, v] = kv.split('='); params[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
  return { type, id: decodeURIComponent(parts[1]), params };
}

/** The https link for something shareable (QR codes, Messages). */
export const linkFor = (kind, id) => {
  const short = Object.keys(KINDS).find((k) => KINDS[k] === kind) || kind;
  return `${SHARE.base.replace(/\/$/, '')}/${short}/${encodeURIComponent(id)}`;
};
