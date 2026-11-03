/**
 * Well-known student programs, matched by store domain, for the Flyer
 * browser extension. Each links to the company's own page, and Flyer
 * never shows prices here because they change; the official page has
 * the current terms. Everything else comes from a cached live lookup
 * with its sources shown.
 */
const PROGRAMS = [
  { domains: ['spotify.com'], name: 'Spotify Premium Student', what: 'Discounted Premium for students at accredited colleges, verified through SheerID.', url: 'https://www.spotify.com/us/student/' },
  { domains: ['amazon.com'], name: 'Prime Student', what: 'A free trial, then a lower Prime price for college students.', url: 'https://www.amazon.com/primestudent' },
  { domains: ['github.com'], name: 'GitHub Student Developer Pack', what: 'Free developer tools and credits for verified students.', url: 'https://education.github.com/pack' },
  { domains: ['apple.com'], name: 'Apple education pricing', what: 'Education prices on Mac and iPad, plus a seasonal back-to-school offer.', url: 'https://www.apple.com/us-edu/store' },
  { domains: ['adobe.com'], name: 'Creative Cloud for students', what: 'Student and teacher pricing on Creative Cloud.', url: 'https://www.adobe.com/creativecloud/buy/students.html' },
  { domains: ['youtube.com'], name: 'YouTube Premium Student', what: 'A student membership price, verified each year.', url: 'https://www.youtube.com/premium/student' },
  { domains: ['microsoft.com', 'office.com'], name: 'Microsoft 365 Education', what: 'Students can often use Office with their school email for free. Check with your school first.', url: 'https://www.microsoft.com/en-us/education/products/office' },
  { domains: ['notion.so', 'notion.com'], name: 'Notion for Education', what: 'Free Plus plan for students with a school email.', url: 'https://www.notion.com/product/notion-for-education' },
];

const bare = (d) => String(d || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0];
function programFor(domain) {
  const d = bare(domain);
  return PROGRAMS.find((p) => p.domains.some((x) => d === x || d.endsWith(`.${x}`))) || null;
}

module.exports = { PROGRAMS, programFor, bare };
