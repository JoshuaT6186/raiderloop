/**
 * Campus hub data for Texas Tech ("ttu").
 * ------------------------------------------------------------
 * Every link and number here was checked against the official TTU
 * page noted beside it (Oct 28, 2026). Flyer links out to the real
 * system for anything official (applying, paying, dropping); it never
 * recreates those forms. Re-check dates each semester: they come
 * from the 2026-27 detailed academic calendar.
 */

const CAL = 'https://www.depts.ttu.edu/officialpublications/calendar/26-27_cal_detailed.php';
const RAIDERLINK = 'https://www.raiderlink.ttu.edu';

/* ---------- Jobs ----------
   Source: depts.ttu.edu/careercenter/jobsearch/oncampusjobs.php */
export const JOB_BOARDS = [
  { id: 'sec', name: 'Red Raider Student Employment Center', note: 'Department jobs, off-campus jobs, and every federal work-study job', url: 'https://ttu.studentemployment.ngwebsolutions.com/', tags: ['On campus', 'Work-study', 'Off campus'] },
  { id: 'hr', name: 'TTU HR student positions', note: 'University student jobs posted by Human Resources', url: 'https://sjobs.brassring.com/TGnewUI/Search/Home/Home?partnerid=25898&siteid=5639#home', phone: '806-742-3851', tags: ['On campus'] },
  { id: 'hire', name: 'Hire Red Raiders', note: 'Career Center board for jobs and internships', url: 'https://ttu.12twenty.com/Login', phone: '806-742-2210', tags: ['Internships', 'Off campus'] },
  { id: 'announce', name: 'TechAnnounce', note: 'Some departments post openings here. Follow the Student Employment category.', url: 'https://techannounce.ttu.edu/', tags: ['On campus'] },
];

export const DEPT_JOBS = [
  { id: 'rec', name: 'Rec Center', url: 'https://www.depts.ttu.edu/recsports/facilities/employment.php' },
  { id: 'sub', name: 'Student Union', url: 'https://www.depts.ttu.edu/sub/jobs.php' },
  { id: 'lib', name: 'Library', url: 'https://apps.lib.ttu.edu/about/employment/positionDashboard/index.php' },
  { id: 'housing', name: 'Student Housing', url: 'https://www.depts.ttu.edu/housing/workforhousing.php' },
  { id: 'hosp', name: 'Hospitality (dining)', url: 'https://www.depts.ttu.edu/hospitality/jobs.php' },
  { id: 'ithc', name: 'IT Help Central', url: 'https://www.depts.ttu.edu/ithelpcentral/employment/student_employment.php' },
  { id: 'ath', name: 'Athletics', url: 'https://texastech.com/sports/2023/10/10/student-employment' },
  { id: 'lc', name: 'The Learning Center', url: 'https://www.depts.ttu.edu/provost/aiss/learning-center/EmploymentOpportunities.php' },
  { id: 'uwc', name: 'Undergraduate Writing Center', url: 'https://www.depts.ttu.edu/provost/uwc/undergraduate/hiring.php' },
  { id: 'adm', name: 'Undergraduate Admissions', url: 'https://www.depts.ttu.edu/admissions/StudentStaff/list.php' },
  { id: 'orient', name: 'Orientation (Red Raider Orientation and Camp)', url: 'https://www.depts.ttu.edu/orientation/workwithus/' },
  { id: 'rise', name: 'RISE', url: 'https://www.depts.ttu.edu/rise/jobs.php' },
  { id: 'usa', name: 'United Supermarkets Arena', url: 'https://www.depts.ttu.edu/unitedsupermarketsarena/contact/employment.php' },
];

export const JOB_HELP = {
  careerCenter: { name: 'University Career Center', phone: '806-742-2210', url: 'https://www.depts.ttu.edu/careercenter/' },
  successHub: { name: 'Raider Success Hub', note: 'Book a career appointment', url: 'https://texastech.force.com/raidersuccess/' },
  workStudy: { name: 'Work-study questions', note: 'Financial Aid Office', email: 'student.employment@ttu.edu', phone: '806-742-3681' },
  source: 'https://www.depts.ttu.edu/careercenter/jobsearch/oncampusjobs.php',
};

export const JOB_STATUSES = [
  { id: 'saved', label: 'Saved', color: 'lavender' },
  { id: 'applied', label: 'Applied', color: 'yellow' },
  { id: 'interview', label: 'Interview', color: 'blue' },
  { id: 'offer', label: 'Offer', color: 'green' },
  { id: 'closed', label: 'Closed', color: 'pink' },
];

/* ---------- Money ----------
   Sources: depts.ttu.edu/scholarships, depts.ttu.edu/raiderrelief,
   help.sbs.ttu.edu (Student Business Services). */
export const MONEY = {
  scholarships: [
    { id: 'su', name: 'Scholarship Universe', note: 'Search and apply for TTU scholarships', url: 'https://www.depts.ttu.edu/scholarships/scholarship-universe/' },
    { id: 'cont', name: 'Continuing student scholarships', note: 'For students already at Tech', url: 'https://www.depts.ttu.edu/scholarships/currentStudentsScholarships.php' },
    { id: 'accept', name: 'Accept a scholarship', url: 'https://www.depts.ttu.edu/scholarships/accept/index.php' },
    { id: 'faq', name: 'Scholarship FAQ', url: 'https://www.depts.ttu.edu/scholarships/ScholarshipsFAQ.php' },
  ],
  aid: [
    { id: 'fa', name: 'Financial Aid', note: 'FAFSA, grants, loans and work-study', url: 'https://www.depts.ttu.edu/financialaid/' },
    { id: 'special', name: 'Special circumstances', note: "If your family's money situation changed", url: 'https://www.depts.ttu.edu/financialaid/specialCircumstances.php' },
  ],
  bill: [
    { id: 'pay', name: 'Log in and pay your bill', note: 'Student Business Services', url: 'https://help.sbs.ttu.edu/TDClient/209/Portal/KB/Article/6967/Login-Pay-Students' },
    { id: 'plan', name: 'Set up a payment plan', note: 'Split tuition, fees and housing into payments', url: 'https://help.sbs.ttu.edu/TDClient/209/Portal/KB/Article/10004/User-Guide-Payment-Plan-Enrollment-Process' },
    { id: 'dates', name: 'Bill due dates', url: 'https://help.sbs.ttu.edu/TDClient/209/Portal/KB/Article/5958/Important-Dates-TTU-Undergraduate-Graduate-Law-School-and-Vet-School' },
  ],
  help: [
    { id: 'rr', name: 'Raider Relief', note: 'Help with food, housing, utilities, hygiene, childcare and textbooks. 170 Drane Hall · 806-742-5175', url: 'https://www.depts.ttu.edu/raiderrelief/', phone: '806-742-5175' },
    { id: 'fund', name: 'Raider Relief Fund', note: 'One-time emergency money for a crisis', url: 'https://www.depts.ttu.edu/raiderrelief/raider-relief-fund.php' },
    { id: 'pantry', name: "Raider Red's Food Pantry", note: 'Drane Hall 132. Mon, Tue, Thu, Fri 10 AM–4 PM · Wed 10 AM–1 PM (Fall 2026). Bring your student ID. No proof of income needed.', url: 'https://www.depts.ttu.edu/raiderrelief/foodpantry.php' },
    { id: 'r2b', name: 'Red to Black', note: 'Free help with budgeting and money skills', url: 'https://www.depts.ttu.edu/r2b/' },
  ],
  contact: { email: 'scholarships@ttu.edu', phone: '806-742-3681' },
};

/* ---------- Forms & processes ----------
   "How do I…" answers with the real place to do it. Sources:
   depts.ttu.edu/registrar, the 2026-27 detailed calendar, SDS. */
export const FORMS = [
  { id: 'drop', title: 'Drop a class', keywords: 'drop class course w withdraw from a class remove', body: 'Drop it yourself on MyTech in Raiderlink. Fall 2026: the last day to drop (counts as a W) is Mon, Nov 16. Talk to your advisor first if it affects financial aid or full-time status.', url: RAIDERLINK, cta: 'Open Raiderlink', source: CAL },
  { id: 'withdraw', title: 'Withdraw from the university', keywords: 'withdraw leave semester all classes quit', body: 'Withdrawing drops every class for the semester. Fall 2026 deadline: Mon, Nov 16. Talk to your advisor and Financial Aid before you do it.', url: CAL, cta: 'See the calendar', source: CAL },
  { id: 'register', title: 'Register for next semester', keywords: 'register registration spring classes enroll schedule advance', body: 'Spring 2027 advance registration opens Mon, Nov 2 at 7:30 AM. Check your registration time and holds in Raiderlink first.', url: 'https://www.depts.ttu.edu/registrar/advance_registration.php', cta: 'How registration works', source: CAL },
  { id: 'transcript', title: 'Get a transcript', keywords: 'transcript official records grades send', body: 'Order official transcripts through the Registrar.', url: 'https://www.depts.ttu.edu/registrar/transcript.php', cta: 'Transcripts' },
  { id: 'verify', title: 'Prove you are enrolled', keywords: 'enrollment verification letter insurance proof student degree', body: 'For insurance, jobs, or loans that need proof you are a student.', url: 'https://www.depts.ttu.edu/registrar/degree_verification.php', cta: 'Enrollment verification' },
  { id: 'grade', title: 'Retake a class to replace a grade', keywords: 'grade replacement retake repeat gpa', body: 'Read the grade replacement rules before you retake a class.', url: 'https://www.depts.ttu.edu/registrar/Grade_Replacement.php', cta: 'Grade replacement' },
  { id: 'major', title: 'Change your major', keywords: 'change major switch declare explore', body: 'The steps depend on the college you want to move into.', url: 'https://www.depts.ttu.edu/admissions/academics/major-change/index.php', cta: 'Major change process' },
  { id: 'degreeworks', title: 'See what classes you still need', keywords: 'degreeworks degree audit requirements plan graduate', body: 'DegreeWorks shows what counts toward your degree and what is left.', url: 'https://www.depts.ttu.edu/registrar/degreeworks/', cta: 'DegreeWorks' },
  { id: 'name', title: 'Change your name on records', keywords: 'name change ssn records', body: 'The Registrar handles legal name and SSN updates.', url: 'https://www.depts.ttu.edu/registrar/NameSSN_Change.php', cta: 'Name & SSN changes' },
  { id: 'accom', title: 'Request disability accommodations', keywords: 'accommodations disability sds testing extra time adhd', body: 'Student Disability Services sets up academic accommodations.', url: 'https://www.depts.ttu.edu/sds/request-accommodations.php', cta: 'Request accommodations' },
  { id: 'external', title: 'Report an outside scholarship', keywords: 'external scholarship report outside award', body: 'If you won a scholarship from outside Tech, report it so it is applied to your account.', url: 'https://www.depts.ttu.edu/scholarships/', cta: 'Scholarships office' },
  { id: 'ferpa', title: 'Let a parent see your records', keywords: 'ferpa parent access privacy records', body: 'Your records are private by law (FERPA). Here is how sharing works.', url: 'https://www.depts.ttu.edu/registrar/FERPA/Students/', cta: 'FERPA for students' },
  { id: 'calendar', title: 'Check a deadline', keywords: 'calendar deadline dates holiday break finals last day', body: 'The official academic calendar has every deadline.', url: CAL, cta: 'Academic calendar' },
];

/* ---------- Health & safety ----------
   Sources: depts.ttu.edu/scc, depts.ttu.edu/dos/student-health.php,
   depts.ttu.edu/parking/.../RaiderRide.php */
export const HEALTH = {
  crisis: [
    { id: 'helpline', name: 'TTU Crisis HelpLine', note: '24/7, every day of the year. For a mental health crisis, suicidal thoughts, sexual assault, or relationship violence.', phone: '806-742-5555', source: 'https://www.depts.ttu.edu/scc/' },
    { id: '988', name: '988 Suicide & Crisis Lifeline', note: 'Call or text 988, any time.', phone: '988', sms: '988' },
  ],
  care: [
    { id: 'scc', name: 'Student Counseling Center', note: 'Student Wellness Center, room 201 (Flint Ave. and Main St.). Walk in Mon–Fri 12:30–3:30 PM to get started.', phone: '806-742-3674', url: 'https://www.depts.ttu.edu/scc/' },
    { id: 'shs', name: 'Student Health Services', note: 'Urgent care, pharmacy, and mental health care', phone: '806-743-2848', url: 'https://www.depts.ttu.edu/studenthealth/' },
    { id: 'psy', name: 'Psychology Clinic', note: 'Low-cost counseling by appointment', phone: '806-742-3737', url: 'https://www.depts.ttu.edu/psy/clinic/info.php' },
    { id: 'sds', name: 'Student Disability Services', note: 'Accommodations for classes, housing and dining', url: 'https://www.depts.ttu.edu/sds/' },
    { id: 'okay', name: 'Beyond Okay', note: 'Wellbeing resources from TTU', url: 'https://www.ttu.edu/wellbeing/' },
    { id: 'rec', name: 'Rec Sports', note: 'Gym, classes, intramurals', url: 'https://www.depts.ttu.edu/recsports/' },
  ],
  getHome: [
    { id: 'raiderride', name: 'Raider Ride', note: 'Free night shuttle on campus, 6:00 PM–2:45 AM every day during the semester. Request a ride in the TechRide app with your eRaider login. Bring your student ID.', phone: '806-742-7275', url: 'https://www.depts.ttu.edu/parking/InformationFor/MobilitySolutions/RaiderRide.php' },
    { id: 'bluelight', name: 'Blue light phones', note: 'Pick up the receiver and it calls TTU Police right away.', url: 'https://www.depts.ttu.edu/sga/SafeWayHomePrograms.php' },
  ],
};

/* ---------- Study rooms (TTU Library, LibCal) ----------
   Source: depts.ttu.edu/library/studySpaces/ */
export const STUDY_ROOMS = [
  { id: 'r2', label: '2–4 people', url: 'https://cal.library.ttu.edu/spaces?lid=5124&gid=8867' },
  { id: 'r5', label: '5–6 people', url: 'https://cal.library.ttu.edu/spaces?lid=5124&gid=15275' },
  { id: 'r7', label: '7–12 people', url: 'https://cal.library.ttu.edu/spaces?lid=5124&gid=15276' },
];
export const STUDY_ROOMS_HELP = { phone: '806-742-2265', source: 'https://www.depts.ttu.edu/library/studySpaces/' };

/* ---------- Course catalog ---------- */
export const CATALOG = {
  label: '2026–2027 Catalog',
  searchUrl: 'https://catalog.ttu.edu/content.php?catoid=26&navoid=2326',
};

/* ---------- Key dates ----------
   From the 2026-27 detailed academic calendar and the scholarships
   office. `end` is optional for multi-day items. */
export const KEY_DATES = [
  { date: '2026-11-01', title: 'Spring priority scholarship deadline', kind: 'money', source: 'https://www.depts.ttu.edu/scholarships/' },
  { date: '2026-11-02', title: 'Spring 2027 registration opens (7:30 AM)', kind: 'school', source: CAL },
  { date: '2026-11-16', title: 'Last day to drop a class or withdraw', kind: 'school', source: CAL },
  { date: '2026-11-25', end: '2026-11-29', title: 'Thanksgiving break', kind: 'break', source: CAL },
  { date: '2026-12-02', title: 'Last day of fall classes', kind: 'school', source: CAL },
  { date: '2026-12-04', end: '2026-12-09', title: 'Fall finals', kind: 'school', source: CAL },
  { date: '2026-12-11', end: '2026-12-12', title: 'Commencement', kind: 'school', source: CAL },
  { date: '2027-01-13', title: 'Spring classes begin', kind: 'school', source: CAL },
  { date: '2027-01-29', title: 'Last day to drop a spring class with no penalty', kind: 'school', source: CAL },
  { date: '2027-02-01', title: 'Continuing student scholarship deadline', kind: 'money', source: 'https://www.depts.ttu.edu/scholarships/' },
  { date: '2027-02-15', title: 'FAFSA / TASFA state priority deadline', kind: 'money', source: 'https://www.depts.ttu.edu/scholarships/' },
  { date: '2027-03-13', end: '2027-03-21', title: 'Spring break', kind: 'break', source: CAL },
  { date: '2027-04-19', title: 'Last day to drop a spring class (with a W)', kind: 'school', source: CAL },
];

/* Upcoming dates (including ones happening right now). */
export function upcomingDates(now = new Date(), n = 3) {
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  return KEY_DATES
    .filter((d) => new Date(`${d.end || d.date}T23:59:59`) >= today)
    .slice(0, n)
    .map((d) => {
      const start = new Date(`${d.date}T00:00:00`);
      const days = Math.round((start - today) / 86400000);
      return { ...d, days };
    });
}

export function dateLabel(d) {
  const fmt = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.end ? `${fmt(d.date)}–${fmt(d.end)}` : fmt(d.date);
}

/* ---------- "How do I…?" search ----------
   Plain keyword matching over everything above, so the hub answers
   common questions instantly and offline. Anything it can't match
   goes to Pilot. */
const HELP_INDEX = [
  ...FORMS.map((f) => ({ id: `form-${f.id}`, title: f.title, body: f.body, url: f.url, cta: f.cta, words: `${f.title} ${f.keywords}` })),
  { id: 'jobs', title: 'Find a job on campus', body: 'Every TTU job board in one place, plus a tracker for what you applied to.', sheet: { type: 'jobs' }, words: 'job jobs work hiring employment campus part time student worker work-study' },
  { id: 'scholar', title: 'Find scholarships', body: 'Search Scholarship Universe and see upcoming deadlines.', sheet: { type: 'money' }, words: 'scholarship scholarships money aid free' },
  { id: 'aid', title: 'Financial aid and FAFSA', body: 'FAFSA opened Oct 1. The state priority deadline is Feb 15, 2027.', sheet: { type: 'money' }, words: 'fafsa financial aid loans grants tasfa' },
  { id: 'bill', title: 'Pay my bill or set up a payment plan', body: 'Student Business Services handles bills and payment plans.', sheet: { type: 'money' }, words: 'pay bill tuition payment plan fees due' },
  { id: 'food', title: 'Get free food', body: "Raider Red's Food Pantry in Drane Hall 132 is free for enrolled students. Bring your ID.", sheet: { type: 'money' }, words: 'food pantry hungry free groceries meal' },
  { id: 'emergency', title: 'Emergency money', body: 'The Raider Relief Fund gives one-time help in a crisis.', sheet: { type: 'money' }, words: 'emergency money crisis rent help broke' },
  { id: 'counsel', title: 'Talk to a counselor', body: 'Walk in to the Student Counseling Center Mon–Fri 12:30–3:30 PM. In a crisis, call 806-742-5555 any time.', sheet: { type: 'health' }, words: 'counseling counselor therapy mental health stress anxiety depressed sad talk' },
  { id: 'doctor', title: 'See a doctor', body: 'Student Health Services: 806-743-2848.', sheet: { type: 'health' }, words: 'doctor sick health clinic medicine pharmacy nurse' },
  { id: 'ride', title: 'Get a ride home at night', body: 'Raider Ride runs 6:00 PM–2:45 AM. Use the TechRide app.', sheet: { type: 'health' }, words: 'ride night shuttle walk home safe late raider ride' },
  { id: 'room', title: 'Book a study room', body: 'Reserve a Library group study room by group size.', sheet: { type: 'course' }, words: 'study room book reserve library group space' },
  { id: 'course', title: 'Look up a class', body: 'Credit hours, description and prerequisites from the catalog.', sheet: { type: 'course' }, words: 'course class catalog credit hours prerequisite description' },
  { id: 'calc', title: 'Use a calculator', body: 'Scientific and graphing calculators.', sheet: { type: 'tools' }, words: 'calculator graph graphing math desmos ti scientific' },
  { id: 'deals', title: 'Student discounts', body: 'Places near campus that take your student ID.', sheet: { type: 'deals' }, words: 'discount deal deals coupon student id cheap' },
];

export function searchHelp(q, limit = 5) {
  const words = String(q || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
  if (!words.length) return [];
  return HELP_INDEX
    .map((h) => {
      const hay = h.words.toLowerCase();
      const score = words.reduce((s, w) => s + (hay.includes(w) ? (w.length > 3 ? 2 : 1) : 0), 0);
      return { ...h, score };
    })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
const STOP = new Set(['how', 'do', 'to', 'the', 'my', 'an', 'is', 'can', 'where', 'what', 'for', 'get', 'on', 'in', 'of', 'and', 'it', 'me', 'at', 'when', 'does', 'should', 'need']);

export const HELP_SUGGESTIONS = ['drop a class', 'find scholarships', 'book a study room', 'get a ride home', 'free food'];
