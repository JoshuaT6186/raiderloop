/**
 * The "next game" card, all year.
 * Live schedules and scores come from getGames (football and men's
 * basketball). If that can't load, the built-in football schedule is
 * used, and a score is only shown when it's known (never a stale one).
 * After football season ends, the card moves to basketball.
 */
import { useMemo } from 'react';
import { api } from './firebase';
import { useCallable } from './hooks';
import { FOOTBALL_SCHEDULE } from '../data/campus';

const STADIUM = { venue: 'Galaxy Stadium', buildingId: 'jones-att-stadium' };

function pick(list, now) {
  const t = now.getTime();
  const next = list.find((g) => Date.parse(g.kickoff) > t - 3 * 3600000 && !g.completed) || null;
  const past = list.filter((g) => Date.parse(g.kickoff) <= t && g.result);
  return { next, last: past.length ? past[past.length - 1] : null };
}

export function useGames(now = new Date()) {
  const live = useCallable(api.getGames, {}, null, { asArray: false });
  return useMemo(() => {
    const d = live.data || {};
    const football = (d.football && d.football.length ? d.football : FOOTBALL_SCHEDULE.map((g) => ({ ...g, completed: Date.parse(g.kickoff) < now.getTime() - 4 * 3600000 })))
      .map((g) => (g.homeAway === 'home' ? { ...STADIUM, ...g, venue: g.venue || STADIUM.venue } : g));
    const basketball = d.basketball || [];
    const fb = pick(football, now);
    // The built-in schedule doesn't track scores, so only show a "Last:" score from the live feed.
    if (!(d.football && d.football.length)) fb.last = null;
    if (fb.next) return { sport: 'Football', ...fb, loading: live.loading };
    const bb = pick(basketball, now);
    if (bb.next) return { sport: 'Basketball', ...bb, loading: live.loading, offseasonNote: 'Football season is done. Basketball is up next.' };
    return { sport: null, next: null, last: fb.last, loading: live.loading };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.data, live.loading, Math.floor(now.getTime() / 600000)]);
}
