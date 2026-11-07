/**
 * Campus Guide: Texas Tech and Lubbock for anyone, no account and no
 * school pick needed (prospective students, parents, visitors, judges).
 * Numbers carry their source and the date Flyer checked them.
 */
export const GUIDE_CHECKED = '2026-11-06';

export const GUIDE = {
  school: 'Texas Tech University',
  city: 'Lubbock, Texas',
  glance: [
    { label: 'Students (fall 2026)', value: '45,812', note: 'A record, and the first time past 45,000', source: 'https://www.ttu.edu/now/posts/2026/08/texas-tech-passes-historic-45000-student-milestone.php' },
    { label: 'New first-year students', value: '9,552+', note: 'The largest first-year class in school history', source: 'https://www.ttu.edu/now/posts/2026/08/texas-tech-passes-historic-45000-student-milestone.php' },
    { label: 'Founded', value: '1923', note: 'As Texas Technological College; classes began in 1925' },
    { label: 'Colors', value: 'Scarlet and black' },
    { label: 'Conference', value: 'Big 12' },
    { label: 'Research', value: 'R1', note: 'The top tier of U.S. research universities (Carnegie)' },
  ],
  admissions: {
    intro: 'Texas Tech guarantees admission based on high school class rank plus an ACT or SAT score. Everyone else gets a full holistic review.',
    table: [
      { rank: 'Top 10%', score: 'No minimum score' },
      { rank: 'Rest of the first quarter', score: 'ACT 24 or SAT 1180' },
      { rank: 'Second quarter', score: 'ACT 26 or SAT 1240' },
      { rank: 'Third quarter', score: 'ACT 27 or SAT 1280' },
      { rank: 'Fourth quarter', score: 'Application review' },
    ],
    notes: [
      'Test-optional applications are allowed and reviewed holistically.',
      'Holistic review looks at grades and course rigor (Honors, AP, IB), activities, leadership, service, and your story. Essays and up to 3 recommendation letters help.',
      'Some programs, like business (Rawls) and engineering (Whitacre), only admit students who meet the assured admission table.',
    ],
    source: 'https://www.depts.ttu.edu/admissions/apply/status/first_freshmen',
  },
  study: {
    intro: 'A few names you will hear a lot:',
    known: [
      { name: 'Rawls College of Business', why: 'Business majors from accounting to marketing.' },
      { name: 'Whitacre College of Engineering', why: 'Includes petroleum, mechanical, civil and computer engineering.' },
      { name: 'Architecture, Media & Communication, Agricultural Sciences, Human Sciences', why: 'Big programs with their own buildings and traditions.' },
    ],
    tip: 'Inside the app, Major Explorer shows what each major is really like and the classes you would take.',
  },
  traditions: [
    { name: 'Guns Up', what: 'The hand sign: thumb up, index finger out like a pistol. You will see it at every game.' },
    { name: 'The Masked Rider', what: 'A student in a black mask and cape rides a black horse onto the field before football games.' },
    { name: 'Raider Red', what: 'The costumed mascot with the oversized mustache and two pistols.' },
    { name: 'Carol of Lights', what: 'Every December, thousands of red, white and orange lights come on across campus at once.' },
    { name: 'Victory Bells', what: 'The bells in the Administration Building ring after big wins and on special days.' },
    { name: 'Will Rogers and Soapsuds', what: 'The statue is wrapped in red crepe paper before home football games.' },
  ],
  alumni: [
    { name: 'Patrick Mahomes', what: 'Super Bowl winning quarterback. Played at Texas Tech.' },
    { name: 'Rick Husband', what: 'NASA astronaut and commander of Space Shuttle Columbia. Mechanical engineering graduate.' },
    { name: 'Ed Whitacre', what: 'Former CEO of AT&T and General Motors. The engineering college carries his name.' },
    { name: 'Jerry Rawls', what: 'Tech founder and business leader. The business college carries his name.' },
    { name: 'Sheryl Swoopes', what: 'Basketball Hall of Famer who led Tech to the 1993 national title.' },
    { name: 'Wes Welker', what: 'Record-setting NFL receiver who starred at Tech.' },
  ],
  lubbock: {
    intro: 'Lubbock is a West Texas city of more than 250,000 people with big skies, cheap living, and a real music history.',
    things: [
      { name: 'Buddy Holly Center', what: 'The rock and roll legend was from Lubbock.' },
      { name: 'Depot District', what: 'Live music, restaurants and coffee.' },
      { name: 'National Ranching Heritage Center', what: 'Historic ranch buildings on the edge of campus. Free.' },
      { name: 'Museum of Texas Tech University', what: 'Art, natural history and a planetarium on campus.' },
      { name: 'Lubbock Lake Landmark', what: 'Trails through 12,000 years of history.' },
      { name: 'Prairie Dog Town in Mackenzie Park', what: 'A Lubbock classic. Free.' },
      { name: 'Science Spectrum', what: 'A hands-on science museum with a dome theater.' },
      { name: 'Cactus Theater', what: 'A restored 1938 theater with live shows.' },
    ],
  },
  links: [
    { label: 'Apply and admissions', url: 'https://www.depts.ttu.edu/admissions/' },
    { label: 'Texas Tech home page', url: 'https://www.ttu.edu/' },
  ],
  disclaimer: 'Flyer is independent and not affiliated with Texas Tech University. Always confirm admissions details with TTU.',
};
