/* global chrome */
// The popup: looks up the site you're on (only when you open it).
// 1) A known student program (built in, instant).
// 2) Flyer's live check: a student discount and recent coupon codes
//    found on the web, with where each one came from.
import { programFor, bare, API_BASE } from './programs.js';

const main = document.getElementById('main');
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v); });
  kids.flat().forEach((c) => n.append(c && c.nodeType ? c : document.createTextNode(c == null ? '' : String(c))));
  return n;
};
const link = (href, text) => el('a', { href, target: '_blank', rel: 'noopener' }, text);
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };

async function currentDomain() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !/^https?:/.test(tab.url)) return null;
  return bare(new URL(tab.url).hostname);
}

function render(domain, program, live, error) {
  main.replaceChildren();
  main.append(el('p', { class: 'muted' }, 'On ', el('b', {}, domain)));
  if (program) {
    main.append(el('div', { class: 'note green' },
      el('h2', {}, program.name),
      el('p', {}, program.what),
      link(program.url, 'Official page ↗')));
  }
  if (live && live.studentDiscount) {
    const s = live.studentDiscount;
    main.append(el('div', { class: 'note' },
      el('h2', {}, 'Student discount'),
      el('p', {}, s.summary),
      s.howTo ? el('p', { class: 'small' }, s.howTo) : '',
      s.url ? link(s.url, 'Where to get it ↗') : '',
      s.source ? el('p', { class: 'small muted' }, 'Source: ', link(s.source, host(s.source))) : ''));
  }
  (live && live.coupons || []).forEach((c) => {
    const copy = el('button', { class: 'ghost', onclick: async () => { try { await navigator.clipboard.writeText(c.code); copy.textContent = 'Copied'; } catch (e) { copy.textContent = 'Copy failed'; } } }, 'Copy');
    main.append(el('div', { class: 'note blue' },
      el('div', { class: 'code' }, el('b', {}, c.code), copy),
      el('p', {}, c.desc || ''),
      c.source ? el('p', { class: 'small muted' }, 'Seen on ', link(c.source, host(c.source))) : ''));
  });
  if (error) main.append(el('p', { class: 'muted' }, error));
  else if (!program && !(live && (live.studentDiscount || (live.coupons || []).length))) {
    main.append(el('div', { class: 'note' }, el('h2', {}, 'Nothing found here'), el('p', {}, "We didn't find a student discount or a current code for this store. Many places still give one in person with your student ID: just ask.")));
  }
  if (live && live.checkedAt) main.append(el('p', { class: 'small muted' }, `Checked ${new Date(live.checkedAt).toLocaleDateString()}`));
}

async function run() {
  const domain = await currentDomain();
  if (!domain) { main.replaceChildren(el('p', { class: 'muted' }, 'Open a store website, then click Flyer again.')); return; }
  const program = programFor(domain);
  render(domain, program, null, null);
  main.append(el('p', { class: 'muted', id: 'checking' }, 'Looking for codes…'));
  try {
    const r = await fetch(`${API_BASE}/ext/deals?domain=${encodeURIComponent(domain)}`);
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Flyer is busy right now.');
    render(domain, program, j, null);
  } catch (e) {
    render(domain, program, null, e.message || "Couldn't reach Flyer right now.");
  }
}

/* Badge toggle (asks Chrome for the tabs permission only if you want it). */
const badge = document.getElementById('badge');
chrome.storage.local.get('badge').then(({ badge: on }) => { badge.checked = !!on; });
badge.addEventListener('change', async () => {
  if (badge.checked) {
    const ok = await chrome.permissions.request({ permissions: ['tabs'] });
    if (!ok) { badge.checked = false; return; }
  }
  await chrome.storage.local.set({ badge: badge.checked });
});

run();
