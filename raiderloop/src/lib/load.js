/**
 * "Busiest week": how heavy each week of the semester looks, from
 * your Planner (assignments, exams from a syllabus, group deadlines).
 * The point is to see crunch weeks coming, and to notice light weeks
 * where getting ahead (or resting) makes sense.
 */
const WEIGHT = { exam: 5, final: 6, midterm: 5, project: 4, paper: 4, presentation: 3, quiz: 2, lab: 1.5, assignment: 1.5, other: 1 };

export function weightFor(item) {
  const t = String(item.type || '').toLowerCase();
  if (WEIGHT[t]) return WEIGHT[t];
  const s = `${item.title || ''}`.toLowerCase();
  if (/final exam|\bfinal\b/.test(s)) return WEIGHT.final;
  if (/midterm|exam|test\b/.test(s)) return WEIGHT.exam;
  if (/project|paper|essay|report/.test(s)) return WEIGHT.project;
  if (/presentation/.test(s)) return WEIGHT.presentation;
  if (/quiz/.test(s)) return WEIGHT.quiz;
  if (/lab\b/.test(s)) return WEIGHT.lab;
  return WEIGHT.assignment;
}

const startOfWeek = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); return x; };

/** Week rows from term start to finals end. */
export function semesterWeeks({ firstDay, finalsEnd, items, now = new Date() }) {
  const start = startOfWeek(new Date(`${firstDay}T12:00:00`));
  const end = new Date(`${finalsEnd}T23:59:59`);
  const weeks = [];
  for (let d = new Date(start), i = 1; d <= end; d.setDate(d.getDate() + 7), i++) {
    const s = new Date(d); const e = new Date(d); e.setDate(e.getDate() + 6); e.setHours(23, 59, 59, 999);
    const inWeek = items.filter((it) => { const t = new Date(it.due).getTime(); return t >= s.getTime() && t <= e.getTime(); });
    const score = Math.round(inWeek.reduce((n, it) => n + weightFor(it), 0) * 10) / 10;
    weeks.push({
      n: i, start: s.toISOString(), end: e.toISOString(),
      label: `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      items: inWeek.sort((a, b) => new Date(a.due) - new Date(b.due)), score,
      isNow: now >= s && now <= e, past: e < now,
    });
  }
  const max = Math.max(1, ...weeks.map((w) => w.score));
  weeks.forEach((w) => { w.level = w.score === 0 ? 'free' : w.score >= Math.max(8, max * 0.75) ? 'heavy' : w.score >= 4 ? 'busy' : 'light'; w.pct = w.score / max; });
  return weeks;
}

/** Up to three plain suggestions, kindest first. */
export function weekTips(weeks, now = new Date()) {
  const tips = [];
  const upcoming = weeks.filter((w) => !w.past);
  const cur = upcoming.find((w) => w.isNow);
  if (cur && cur.level === 'heavy') tips.push({ id: 'rest', icon: 'heart', text: "This is a heavy week. It's okay to skip the optional stuff and get some sleep." });
  const nextHeavy = upcoming.find((w) => !w.isNow && w.level === 'heavy');
  if (nextHeavy) {
    const big = nextHeavy.items.slice().sort((a, b) => weightFor(b) - weightFor(a))[0];
    tips.push({ id: 'ahead', icon: 'clock', text: `The week of ${nextHeavy.label} looks like a crunch${big ? `, with ${big.title}` : ''}. Starting a little the week before helps a lot.` });
  }
  const light = upcoming.find((w) => !w.isNow && (w.level === 'free' || w.level === 'light') && nextHeavy && new Date(w.start) < new Date(nextHeavy.start));
  if (light) tips.push({ id: 'light', icon: 'sun', text: `The week of ${light.label} is light. Good time to get ahead, or to rest on purpose.` });
  return tips.slice(0, 3);
}
