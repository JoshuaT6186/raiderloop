/* Flyer website: waitlist and the App Store button.
   When Flyer is live, paste its App Store link here and the site
   switches from "In App Store review" to a Download button. */
const APP_STORE_URL = '';

(function () {
  const store = document.querySelectorAll('[data-appstore]');
  if (APP_STORE_URL) {
    store.forEach((a) => { a.href = APP_STORE_URL; a.textContent = 'Download on the App Store'; });
    document.querySelectorAll('[data-status]').forEach((s) => { s.textContent = 'Out now'; s.style.color = '#2E8256'; });
    document.querySelectorAll('[data-waitlist]').forEach((w) => { w.innerHTML = `<p style="margin:0">Flyer is on the App Store.</p><p><a class="btn" href="${APP_STORE_URL}">Download on the App Store</a></p>`; });
  }
  const form = document.getElementById('waitlist');
  if (!form) return;
  const msg = document.getElementById('wl-msg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    msg.textContent = 'Saving…';
    try {
      const r = await fetch('/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, source: 'site' }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { msg.textContent = "You're on the list. We'll email you once, when Flyer is out."; form.reset(); }
      else msg.textContent = j.error || "That didn't save. Try again in a minute.";
    } catch (err) { msg.textContent = "Couldn't reach Flyer. Check your connection and try again."; }
  });
}());
