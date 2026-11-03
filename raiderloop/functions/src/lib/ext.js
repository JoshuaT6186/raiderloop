/**
 * Browser extension lookup: known student programs plus a cached live
 * search, with sources. Used by web.js (/ext/deals). Not a Cloud
 * Function module.
 */
const C = require('../common');
const { programFor, bare } = require('./discounts');

const { clean } = C;
const DAY = 24 * 3600000;

/* ---------------- Browser extension lookup (used by web.js) ---------------- */
async function extensionLookup(domain) {
  const d = bare(domain);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return { domain: d, program: null, found: false };
  const program = programFor(d);
  const key = `ext2:${d}`;
  const hit = await C.getCached(key, 7 * DAY);
  if (hit) return { ...hit, program };
  const res = await C.tavilySearch({ query: `${d} student discount OR "student" coupon code`, maxResults: 6, depth: 'basic' });
  const system = `You help a college student see if an online store has a student discount or a working coupon. Use ONLY the search results. ${C.recencyGuard()}
Return ONLY JSON: {"store": string, "studentDiscount": {"summary": string, "howTo": string, "url": string, "source": string} or null, "coupons": [{"code": string, "desc": string, "source": string}] (max 4, only codes printed in the results from this year)}`;
  const out = await C.claudeText({ system, messages: [{ role: 'user', content: `Store: ${d}\n\n${C.resultsText(res).slice(0, 18000)}` }], maxTokens: 700 });
  const j = C.parseJsonObject(out) || {};
  const value = {
    domain: d, store: clean(j.store, 80) || d,
    studentDiscount: j.studentDiscount && j.studentDiscount.summary ? { summary: clean(j.studentDiscount.summary, 240), howTo: clean(j.studentDiscount.howTo, 240), url: C.cleanUrl(j.studentDiscount.url), source: C.cleanUrl(j.studentDiscount.source) } : null,
    coupons: (j.coupons || []).slice(0, 4).map((c) => ({ code: clean(c.code, 30), desc: clean(c.desc, 120), source: C.cleanUrl(c.source) })).filter((c) => c.code),
    checkedAt: new Date().toISOString(),
  };
  await C.setCached(key, value);
  return { ...value, program };
}

module.exports = { extensionLookup };
