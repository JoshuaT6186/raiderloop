/**
 * Texas Tech schedules and scores, kept fresh.
 * Reads ESPN's public schedule feed for football and men's
 * basketball (team 2641 = Texas Tech) and caches it for 3 hours.
 * The app falls back to its built-in football schedule if this ever
 * fails, so a broken feed never shows a wrong score.
 */
const { onCall } = require('firebase-functions/v2/https');
const C = require('./common');

const TEAM = '2641';
const FEEDS = {
  football: `https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams/${TEAM}/schedule`,
  basketball: `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${TEAM}/schedule`,
};

function toGame(ev) {
  const comp = (ev.competitions || [])[0] || {};
  const teams = comp.competitors || [];
  const us = teams.find((x) => String(x.id || x.team?.id) === TEAM);
  const them = teams.find((x) => x !== us);
  if (!us || !them) return null;
  const done = !!(comp.status?.type?.completed || ev.status?.type?.completed);
  const score = (x) => {
    const v = x.score;
    if (v == null) return null;
    const n = typeof v === 'object' ? Number(v.value ?? v.displayValue) : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  let result = null;
  if (done && score(us) != null && score(them) != null) {
    const a = score(us); const b = score(them);
    result = `${a > b ? 'W' : a < b ? 'L' : 'T'} ${a}-${b}`;
  }
  return {
    kickoff: ev.date,
    opponent: them.team?.location || them.team?.shortDisplayName || them.team?.displayName || 'Opponent',
    homeAway: comp.neutralSite ? 'neutral' : (us.homeAway === 'home' ? 'home' : 'away'),
    venue: comp.venue?.fullName || '',
    completed: done,
    result,
  };
}

async function readFeed(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    if (!r.ok) return null;
    const j = await r.json();
    return (j.events || []).map(toGame).filter(Boolean).sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
  } catch (e) {
    console.error('sports feed failed', url, e.message);
    return null;
  } finally { clearTimeout(timer); }
}

exports.getGames = onCall(C.callOpts(), async (request) => {
  C.requireAuth(request);
  const hit = await C.getCached('games_ttu', 3 * C.HOUR);
  if (hit) return { ...hit, cached: true };
  const [football, basketball] = await Promise.all([readFeed(FEEDS.football), readFeed(FEEDS.basketball)]);
  const value = { football: football || [], basketball: basketball || [], checkedAt: new Date().toISOString() };
  if (football || basketball) await C.setCached('games_ttu', value);
  return { ...value, cached: false };
});
