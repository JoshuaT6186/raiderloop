/**
 * First 30 days: a short checklist for new students. Official links
 * were checked on the TTU pages noted (Nov 2, 2026); everything else
 * opens the matching part of Flyer.
 */
import { HEALTH, JOB_HELP } from './hub';

const SCC = HEALTH.care.find((x) => x.id === 'scc');
const RIDE = HEALTH.getHome.find((x) => x.id === 'raiderride');
const REC = HEALTH.care.find((x) => x.id === 'rec');

export const FIRST_WEEKS = [
  { id: 'classes', title: 'Add your classes to Flyer', why: 'Reminders, walk times, and the room finder all use them.', open: { tab: 'schedule' } },
  { id: 'rooms', title: 'Find every classroom before day one', why: 'Type each room into the room finder and see the floor and the doors people use.', open: { sheet: { type: 'rooms' } } },
  { id: 'card', title: 'Get your Raider Card', why: 'University ID Office, Student Union room 105. Bring a government photo ID. You can upload your photo online first.', url: 'https://www.depts.ttu.edu/unvid/Students/studentsID.php' },
  { id: 'eraider', title: 'Set up your eRaider and TTU email', why: 'It signs you into Raiderlink, Canvas, and campus Wi-Fi.', url: 'https://www.depts.ttu.edu/ithelpcentral/' },
  { id: 'techalert', title: 'Check your TechAlert emergency contacts', why: 'Texas Tech texts and emails about campus emergencies. Make sure your phone number is right.', url: 'https://www.ttu.edu/techalert/faq/' },
  { id: 'parking', title: 'Get a parking ePermit (if you drive)', why: 'Permits are tied to your license plate. No sticker or hang tag.', url: 'https://www.depts.ttu.edu/parking/InformationFor/StudentParking.php' },
  { id: 'dining', title: 'Know your dining plan', why: 'What your plan covers, Dining Bucks, and the commuter plan.', url: 'https://www.depts.ttu.edu/hospitality/dining_plans.php' },
  { id: 'syllabus', title: 'Drop in your syllabi', why: 'Every exam and assignment date lands in your Planner, plus office hours.', open: { sheet: { type: 'syllabus' } } },
  { id: 'drop', title: 'Know the drop deadline', why: 'The Campus hub shows the next official deadlines.', open: { tab: 'campus', hub: true } },
  { id: 'org', title: 'Check out one org', why: 'Pick something that sounds fun, even if you just go once.', open: { sheet: { type: 'orgs' } } },
  { id: 'sayhi', title: 'Say hi to someone in your class', why: 'Turn on Say hi to find people who share a class or org with you.', open: { sheet: { type: 'sayhi' } } },
  { id: 'study', title: 'Find a study spot you like', why: 'Library, the SUB, and more, with open hours.', open: { tab: 'discover' } },
  { id: 'ride', title: 'Save Raider Ride for late nights', why: RIDE ? RIDE.note : 'Free night shuttle on campus.', url: RIDE ? RIDE.url : null },
  { id: 'counseling', title: 'Know where to get support', why: SCC ? SCC.note : 'Student Counseling Center.', url: SCC ? SCC.url : null },
  { id: 'rec', title: 'Visit the Rec Center', why: 'Gym, classes, and intramurals are part of your fees.', url: REC ? REC.url : null },
  { id: 'career', title: 'Peek at the Jobs Hub', why: `On-campus jobs and the ${JOB_HELP.careerCenter.name}, whenever you're ready.`, open: { sheet: { type: 'jobs' } } },
];

/** Show the checklist automatically for first-year students, or for
    anyone during the first 30 days of the semester, until it's done
    or dismissed. */
export function firstWeeksActive({ firstWeeks, userClassYear }, term, now = new Date()) {
  if (firstWeeks.on === false) return false;
  if (firstWeeks.on === true) return firstWeeks.done.length < FIRST_WEEKS.length;
  const start = new Date(`${term.firstDay}T00:00:00`);
  const inWindow = now >= new Date(start.getTime() - 14 * 86400000) && now <= new Date(start.getTime() + 30 * 86400000);
  const firstTerm = userClassYear === 'Freshman' && now <= new Date(start.getTime() + 90 * 86400000);
  return (firstTerm || inWindow) && firstWeeks.done.length < FIRST_WEEKS.length;
}
