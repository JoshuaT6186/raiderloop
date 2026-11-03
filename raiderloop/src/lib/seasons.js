/**
 * Seasonal themes
 * ------------------------------------------------------------
 * The calendar lives here, so themes switch on and off by
 * themselves every year. Dates are month-day ("11-01") so they repeat
 * yearly. You can move or disable any season from Firestore
 * (config/app → seasons) without a new build; see lib/remote.js.
 *
 * Each season can change:
 *   decor     a small hand-drawn band at the top of each page
 *   tape      the color of the tape holding notes down
 *   pattern   the washi tape pattern for decorated cards
 *   outfit    what the paper plane wears on the Pilot button
 *   paper     (light mode only) a slight tint on the notebook paper
 *
 * The "Seasonal themes" setting in You → Settings picks how much
 * shows: on (everything), minimal (tape + plane outfit only), or off.
 */

export const SEASONS = [
  {
    id: 'fall', name: 'Fall', start: '11-01', end: '11-30',
    decor: 'leaves', tape: '#E8A15C', pattern: 'stripes', outfit: 'leaf',
    greeting: 'Happy fall',
  },
  {
    id: 'winter', name: 'Winter lights', start: '12-01', end: '12-31',
    decor: 'lights', tape: '#8FB3E3', pattern: 'snow', outfit: 'santa',
    greeting: 'Stay warm out there',
  },
  {
    id: 'newyear', name: 'New Year', start: '01-01', end: '01-07',
    decor: 'fireworks', tape: '#E9C46A', pattern: 'dots', outfit: 'party',
    greeting: 'Happy New Year',
  },
  {
    id: 'valentine', name: "Valentine's", start: '02-01', end: '02-14',
    decor: 'hearts', tape: '#F4A9B8', pattern: 'hearts', outfit: 'heart', paper: '#FDF3F2',
    greeting: 'Sending you good vibes',
  },
  {
    id: 'stpatrick', name: "St. Patrick's", start: '03-11', end: '03-17',
    decor: 'shamrocks', tape: '#9FD3A8', pattern: 'dots', outfit: 'shamrock',
    greeting: 'Feeling lucky',
  },
];

const mmdd = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const valid = (s) => typeof s === 'string' && /^\d{2}-\d{2}$/.test(s);

/* Apply config/app overrides: move dates or disable a season by id. */
export function seasonsWithOverrides(overrides) {
  const list = Array.isArray(overrides) ? overrides : [];
  return SEASONS.map((s) => {
    const o = list.find((x) => x && x.id === s.id);
    if (!o) return s;
    return {
      ...s,
      start: valid(o.start) ? o.start : s.start,
      end: valid(o.end) ? o.end : s.end,
      disabled: !!o.disabled,
    };
  });
}

/** The season active on `date`, or null. Ranges never cross New Year. */
export function activeSeason(date = new Date(), overrides) {
  const key = mmdd(date);
  return seasonsWithOverrides(overrides).find((s) => !s.disabled && s.start <= key && key <= s.end) || null;
}
