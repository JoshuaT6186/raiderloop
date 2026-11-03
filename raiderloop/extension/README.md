# Flyer: Student Deals (browser extension)

A small Chrome extension (Manifest V3) that checks the store you're on
for a student discount or a working coupon code.

- **Private by default.** Nothing is looked up until you click the
  Flyer button. The optional "%" badge uses a built-in list of student
  programs, so your browsing never leaves your computer.
- **Honest.** Every discount and code shows where it was found, and the
  date it was checked. Live results come from Flyer's `/ext/deals`
  endpoint (Cloud Function `web`), cached for 7 days per store and
  rate limited per network.

## Try it in Chrome

1. Go to `chrome://extensions`, turn on **Developer mode**.
2. Click **Load unpacked** and pick this `extension` folder.
3. Visit a store (for example spotify.com) and click the Flyer button.

## Publish

- **Chrome Web Store:** zip the *contents* of this folder and upload at
  https://chrome.google.com/webstore/devconsole (one-time $5 developer fee).
  Privacy tab: the extension sends the current site's domain to Flyer
  only when the popup is opened; no personal data is collected.
- **Safari (Mac):** run
  `xcrun safari-web-extension-converter extension --app-name "Flyer Deals"`
  on a Mac with Xcode, then archive and submit like any Mac app.

## If you change the share domain

Update `API_BASE` in `programs.js` and `host_permissions` in
`manifest.json`. Keep `PROGRAMS` in sync with
`functions/src/lib/discounts.js`.
