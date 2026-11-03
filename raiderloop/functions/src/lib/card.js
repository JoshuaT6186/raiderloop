/**
 * Connect card helpers shared by connect.js (the app) and web.js (the
 * public card page). Not a Cloud Function module.
 */
const C = require('../common');

const { clean } = C;
const SHOW = ['off', 'friends', 'everyone'];
const CARD_DEFAULT_SHOW = { major: 'everyone', headline: 'everyone', orgs: 'everyone', links: 'everyone', email: 'friends', phone: 'off', face: 'friends' };
const LINK_LABELS = ['Portfolio', 'GitHub', 'LinkedIn', 'Instagram', 'Website', 'Resume', 'Other'];

function cleanCard(d) {
  const show = {};
  Object.keys(CARD_DEFAULT_SHOW).forEach((k) => { show[k] = SHOW.includes(d.show?.[k]) ? d.show[k] : CARD_DEFAULT_SHOW[k]; });
  show.face = show.face === 'everyone' ? 'friends' : show.face; // face photos are never public
  const email = clean(d.email, 120);
  const phone = clean(d.phone, 24).replace(/[^\d+()\-\s.]/g, '');
  return {
    headline: clean(d.headline, 90),
    major: clean(d.major, 80),
    classYear: clean(d.classYear, 20),
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '',
    phone,
    orgs: (Array.isArray(d.orgs) ? d.orgs : []).slice(0, 8).map((o) => ({ id: clean(o.id, 80), name: clean(o.name, 80) })).filter((o) => o.name),
    links: (Array.isArray(d.links) ? d.links : []).slice(0, 6).map((l) => ({ label: LINK_LABELS.includes(l.label) ? l.label : 'Other', url: C.cleanUrl(l.url) })).filter((l) => l.url),
    color: clean(d.color, 12) || 'yellow',
    show,
  };
}

function visibleCard(card, level) {
  if (!card) return {};
  const rank = { off: 99, friends: 1, everyone: 0 };
  const ok = (k) => rank[card.show?.[k] || CARD_DEFAULT_SHOW[k]] <= level;
  const out = { color: card.color || 'yellow', classYear: card.classYear || '' };
  if (ok('major')) out.major = card.major || '';
  if (ok('headline')) out.headline = card.headline || '';
  if (ok('orgs')) out.orgs = card.orgs || [];
  if (ok('links')) out.links = card.links || [];
  if (ok('email') && card.email) out.email = card.email;
  if (ok('phone') && card.phone) out.phone = card.phone;
  return out;
}


module.exports = { visibleCard, cleanCard, CARD_DEFAULT_SHOW, SHOW, LINK_LABELS };
