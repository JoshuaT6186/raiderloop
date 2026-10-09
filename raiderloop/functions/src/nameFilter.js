/**
 * Names and usernames: one place that decides what's allowed.
 *
 * Used by saveProfile (display name), setHandle / assignHandle
 * (usernames) and checkName (so the app can warn people as they type).
 * The server is the real gate; the app only mirrors it.
 *
 * It uses the `obscenity` English dataset, which already handles
 * leetspeak (sh1t), look-alike characters and stretched letters, and
 * avoids the "Scunthorpe problem" (it won't flag Essex or Cassandra).
 * Each name is checked three ways so spacing and punctuation tricks
 * don't slip through: as typed, with separators turned into spaces,
 * and with separators removed (f.u.c.k, f_u_c_k).
 */
const { HttpsError } = require('firebase-functions/v2/https');

let matcher = null;
try {
  // eslint-disable-next-line global-require
  const O = require('obscenity');
  matcher = new O.RegExpMatcher({ ...O.englishDataset.build(), ...O.englishRecommendedTransformers });
} catch (e) { console.warn('obscenity not installed: name filter uses the built-in list only'); }

/* Extra terms the dataset doesn't cover. Whole-token matches only, so
   real names like Nazir or Heilman aren't caught. */
const EXTRA_TOKENS = new Set(['nazi', 'nazis', 'hitler', 'heil', 'kkk', 'isis', 'jihadi', 'rapist', 'rapists', 'porn', 'pornhub',
  'kys', 'incel', 'whitepower', 'whitepride', 'sieg', 'molest', 'molester', 'pedo', 'pedophile', 'paedo', 'terrorist', 'pron',
  'spic', 'spick', 'wetback', 'coon', 'gook', 'jizz', 'thot', 'tranny', 'beaner', 'towelhead', 'raghead', 'paki', 'kike', 'chink', 'nigg', 'niga']);
/* Long and unambiguous: also caught inside a longer run of letters. */
const EXTRA_SUBSTRINGS = ['hitler', 'killyourself', 'whitepower', 'pedophile', 'heilhitler', 'nigger', 'nigga', 'faggot', 'phuck'];

/* Real names the dataset's prefix matching flags by mistake. A token
   that exactly matches one of these is skipped before checking. */
const ALLOWED_TOKENS = new Set(['cummings', 'cumming', 'cummins', 'peniston', 'penistone', 'dickson', 'dickinson', 'dickerson', 'dickens', 'dickey',
  'shitij', 'kikelomo', 'kikelomo', 'kikeri', 'kikuchi', 'chinmay', 'chinwe', 'chinedu', 'chinelo', 'titus', 'tito', 'titan', 'sexton', 'sexson',
  'cockburn', 'hancock', 'pussell', 'analise', 'analisa', 'analia', 'analee', 'hoare', 'wang', 'fanny',
  'fukuda', 'fukushima', 'fukui', 'fukuoka', 'fukunaga', 'fukuyama', 'shitara', 'slutsky', 'semenov', 'semenova', 'semenyuk', 'dicksen', 'dicksan']);

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g', '@': 'a', $: 's', '!': 'i', '+': 't' };
/* 1 can stand for i or l, so both readings are tried. */
const leetResolve = (s, one = 'i') => s.replace(/[01345789@$!+]/g, (c) => (c === '1' ? one : LEET[c] || c));
const collapse = (s) => s.replace(/(.)\1+/g, '$1');

function variants(raw) {
  const s = String(raw || '').normalize('NFKC');
  const spaced = s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const joined = spaced.replace(/ /g, '');
  return { s, spaced, joined };
}

/* strict: usernames. They have no spaces to begin with, so the
   separators-removed form is always checked. For display names it's
   only checked when letters look spaced out on purpose (f u c k). */
function isInappropriate(text, { strict = false } = {}) {
  const v = variants(text);
  if (!v.joined) return false;
  const rawTokens = v.spaced.split(' ');
  const keep = rawTokens.filter((t) => !ALLOWED_TOKENS.has(t.toLowerCase()));
  if (!keep.length) return false;
  const s = keep.length === rawTokens.length ? v.s : keep.join(' ');
  const spaced = keep.join(' ');
  const joined = keep.join('');
  const evasive = keep.length >= 2 && keep.some((t) => t.length <= 2);
  const checkJoined = strict || evasive;
  // Numbers stuck on the ends (whore99, 69shit) shouldn't hide a word.
  const bare = keep.map((t) => t.replace(/^\d+|\d+$/g, '')).filter(Boolean);
  const bareSpaced = bare.join(' ');
  if (matcher && (matcher.hasMatch(s) || matcher.hasMatch(spaced) || matcher.hasMatch(bareSpaced)
    || (checkJoined && (matcher.hasMatch(joined) || matcher.hasMatch(bare.join('')))))) return true;
  const reads = (t) => [t.toLowerCase(), collapse(leetResolve(t.toLowerCase())), collapse(leetResolve(t.toLowerCase(), 'l'))];
  for (const tok of spaced.split(' ')) if (reads(tok).some((r) => EXTRA_TOKENS.has(r))) return true;
  if (checkJoined && reads(joined).some((r) => EXTRA_TOKENS.has(r))) return true;
  const flats = reads(joined);
  return EXTRA_SUBSTRINGS.some((w) => flats.some((f) => f.includes(collapse(w)) || f.includes(w)));
}

const URLISH = /(https?:|www\.|\.(com|net|org|io|co|me|gg|ly|app|xyz|edu)(\b|\/)|@\w+\.\w)/i;
const STAFF = /\b(flyer|pilot|ttu|tech)\b.*\b(team|support|official|admin|staff|mod|moderator|help)\b|^\s*(admin|administrator|support|moderator|official|staff|flyer|system)\s*$/i;

const NAME_ERROR = "That name isn't allowed on Flyer. Use your real first name.";

/* Returns { name } or { error }. An empty name is allowed here;
   callers that need one check for it separately. */
function checkDisplayName(raw) {
  const name = String(raw == null ? '' : raw).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!name) return { name: '' };
  if (!/\p{L}/u.test(name)) return { error: 'Use letters in your name.' };
  if (URLISH.test(name)) return { error: "Names can't contain links or email addresses." };
  if (STAFF.test(name)) return { error: NAME_ERROR };
  if (isInappropriate(name)) return { error: NAME_ERROR };
  return { name };
}

const assertDisplayName = (raw) => {
  const r = checkDisplayName(raw);
  if (r.error) throw new HttpsError('invalid-argument', r.error);
  return r.name;
};

module.exports = { isInappropriate, checkDisplayName, assertDisplayName, NAME_ERROR };
