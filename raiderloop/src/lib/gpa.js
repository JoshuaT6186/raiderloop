/* GPA math on the standard 4.0 scale (Texas Tech uses plus/minus
   grades). Grades a student can't count (P, W, I) are excluded. */
export const GRADE_POINTS = {
  'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'C-': 1.7, 'D+': 1.3, 'D': 1.0, 'D-': 0.7, 'F': 0,
};
export const GRADE_OPTIONS = Object.keys(GRADE_POINTS);

export function termGpa(courses) {
  let pts = 0; let hrs = 0;
  for (const c of courses) {
    const g = GRADE_POINTS[c.grade]; const cr = parseFloat(c.credits);
    if (g == null || !(cr > 0)) continue;
    pts += g * cr; hrs += cr;
  }
  return hrs ? { gpa: pts / hrs, hours: hrs, points: pts } : { gpa: null, hours: 0, points: 0 };
}

export function cumulativeGpa(courses, priorGpa, priorCredits) {
  const term = termGpa(courses);
  const pg = parseFloat(priorGpa); const pc = parseFloat(priorCredits);
  if (!(pc > 0) || Number.isNaN(pg)) return term.gpa;
  const total = term.points + pg * pc; const hrs = term.hours + pc;
  return hrs ? total / hrs : null;
}

/* Score (0-100) → letter, for Canvas current scores. Default cutoffs;
   individual syllabi can differ, so the UI labels this an estimate. */
export function scoreToLetter(score) {
  if (score == null) return null;
  if (score >= 90) return 'A'; if (score >= 80) return 'B'; if (score >= 70) return 'C'; if (score >= 60) return 'D'; return 'F';
}

export const fmtGpa = (g) => (g == null ? 'N/A' : g.toFixed(2));
