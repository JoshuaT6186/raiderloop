/* global chrome */
// Puts a small "%" on the toolbar button on sites with a known student
// program. Only runs if you turned on "Show a badge" in the popup
// (that needs the tabs permission, which Chrome asks you about).
// Nothing is sent anywhere: the list is inside the extension.
import { programFor } from './programs.js';

async function badgeFor(tabId, url) {
  try {
    const { badge } = await chrome.storage.local.get('badge');
    if (!badge || !url || !/^https?:/.test(url)) { await chrome.action.setBadgeText({ tabId, text: '' }); return; }
    const p = programFor(new URL(url).hostname);
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#2F5DA8' });
    await chrome.action.setBadgeText({ tabId, text: p ? '%' : '' });
  } catch (e) { /* tab closed */ }
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' || info.url) badgeFor(tabId, tab.url);
});
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try { const tab = await chrome.tabs.get(tabId); badgeFor(tabId, tab.url); } catch (e) { /* no access */ }
});
