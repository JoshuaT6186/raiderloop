/**
 * Scavenger hunts. The server is the source of truth: the app asks
 * getPlay for the hunts that are live today, and createPost checks a
 * hunt photo against the item's `check` question before awarding
 * points. Dates are month-day ranges that repeat every year, matching
 * the seasonal themes in src/lib/seasons.js. To add or change a hunt,
 * edit this file and redeploy functions; the app picks it up.
 *
 * Every hunt is objects and places only, never people.
 */
const HUNTS = [
  {
    id: 'fall', title: 'Fall Hunt', start: '11-01', end: '11-30', bonus: 150,
    items: [
      { id: 'pumpkin', label: 'A pumpkin', check: 'Does the photo clearly show a pumpkin or a pumpkin decoration?' },
      { id: 'redleaf', label: 'A red leaf', check: 'Does the photo clearly show a red or orange autumn leaf?' },
      { id: 'studyspot', label: 'Your favorite study spot', check: 'Does the photo show a place to study, like a desk, table, library, or lounge?' },
      { id: 'orange', label: 'Something orange on campus', check: 'Is the main subject of the photo clearly orange?' },
      { id: 'warmdrink', label: 'A warm drink', check: 'Does the photo show a hot drink, such as coffee, tea, or cocoa in a cup or mug?' },
    ],
  },
  {
    id: 'winter', title: 'Winter Lights Hunt', start: '12-01', end: '12-31', bonus: 150,
    items: [
      { id: 'lights', label: 'String lights', check: 'Does the photo clearly show decorative string lights?' },
      { id: 'tree', label: 'A decorated tree', check: 'Does the photo show a decorated holiday tree?' },
      { id: 'mug', label: 'Something warm in a mug', check: 'Does the photo show a mug or cup with a drink?' },
      { id: 'kit', label: 'Your finals survival kit', check: 'Does the photo show study supplies or snacks, like books, notes, a laptop, or food?' },
      { id: 'snow', label: 'Snow or a snowflake', check: 'Does the photo show snow, frost, or a snowflake decoration?' },
    ],
  },
  {
    id: 'newyear', title: 'New Year Hunt', start: '01-01', end: '01-07', bonus: 120,
    items: [
      { id: 'planner', label: 'Your planner for the new year', check: 'Does the photo show a planner, calendar, or to-do list?' },
      { id: 'sky', label: 'A sunrise or sunset', check: 'Does the photo show a sunrise or sunset sky?' },
      { id: 'sparkle', label: 'Something that sparkles', check: 'Does the photo show something shiny, glittery, or sparkling?' },
    ],
  },
  {
    id: 'valentine', title: "Valentine's Hunt", start: '02-01', end: '02-14', bonus: 120,
    items: [
      { id: 'heart', label: 'Something heart-shaped', check: 'Does the photo show something shaped like a heart?' },
      { id: 'pink', label: 'Something pink or red', check: 'Is the main subject clearly pink or red?' },
      { id: 'flowers', label: 'Flowers', check: 'Does the photo show flowers (real or decorations)?' },
      { id: 'note', label: 'A kind note you wrote', check: 'Does the photo show a handwritten note or card?' },
    ],
  },
  {
    id: 'stpatrick', title: "St. Patrick's Hunt", start: '03-11', end: '03-17', bonus: 120,
    items: [
      { id: 'green', label: 'Something green', check: 'Is the main subject of the photo clearly green?' },
      { id: 'clover', label: 'A clover or shamrock', check: 'Does the photo show a clover, shamrock, or a picture of one?' },
      { id: 'gold', label: 'Something gold', check: 'Is the main subject gold or gold-colored?' },
    ],
  },
  {
    id: 'campus', title: 'Campus Explorer', start: '01-08', end: '12-31', bonus: 150, always: true,
    items: [
      { id: 'statue', label: 'A statue on campus', check: 'Does the photo show a statue or sculpture outdoors?' },
      { id: 'fountain', label: 'A fountain', check: 'Does the photo show a fountain or water feature?' },
      { id: 'view', label: 'The view from a top floor', check: 'Is the photo taken from up high, looking out over buildings or grounds?' },
      { id: 'art', label: 'Public art or a mural', check: 'Does the photo show a mural, artwork, or art installation?' },
      { id: 'bench', label: 'A bench with a good view', check: 'Does the photo show an outdoor bench or seating area?' },
    ],
  },
];

const md = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inRange = (key, start, end) => (start <= end ? key >= start && key <= end : key >= start || key <= end);

/* Seasonal hunts replace the always-on Campus Explorer while they run. */
function liveHunts(now = new Date()) {
  const key = md(now);
  const seasonal = HUNTS.filter((h) => !h.always && inRange(key, h.start, h.end));
  return seasonal.length ? seasonal : HUNTS.filter((h) => h.always && inRange(key, h.start, h.end));
}
const huntById = (id) => HUNTS.find((h) => h.id === id) || null;

module.exports = { HUNTS, liveHunts, huntById };
