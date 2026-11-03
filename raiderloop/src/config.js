/**
 * Flyer — app-wide configuration
 * ------------------------------------------------------------
 * Everything you might need to change before a release lives here,
 * so nothing secret or environment-specific is scattered through the
 * screens. Nothing in this file is a secret: Firebase web config is
 * public by design (security comes from Auth + Firestore rules +
 * function-side checks), and ad/purchase keys are public SDK keys.
 */

export const APP = {
  name: 'Flyer',
  tagline: 'Your campus, folded into one app.',
  supportEmail: 'eternityworks2026@gmail.com',
  privacyUrl: 'https://raiderloop-98046.web.app/privacy.html', // served by Firebase Hosting (hosting/privacy.html)
  termsUrl: 'https://raiderloop-98046.web.app/terms.html',
  disclaimer:
    'Flyer is an independent, student-built app. It is not affiliated with, endorsed by, or sponsored by any university. School names are used only to describe which campus the information is about.',
  storageKey: 'flyer_v1',
};

/* Same Firebase project RaiderLoop used, so the deployed functions,
   cache, and secrets carry over. If you create a fresh "flyer"
   Firebase project instead, paste its web config here. */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCdaILApsJo7KfTKfIH5W_TueYQPr6IZRw',
  authDomain: 'raiderloop-98046.firebaseapp.com',
  projectId: 'raiderloop-98046',
  storageBucket: 'raiderloop-98046.firebasestorage.app',
  messagingSenderId: '549349537291',
  appId: '1:549349537291:web:a9d31e7635ea7f9403b90e',
};

/* Schools. Only schools with `active: true` are selectable. Adding a
   school later means adding its data (buildings, dining, orgs) — the
   picker is cheap, the data is the real product. */
export const SCHOOLS = [
  {
    id: 'ttu',
    name: 'Texas Tech University',
    short: 'Texas Tech',
    city: 'Lubbock, TX',
    active: true,
    tz: 'America/Chicago',
    center: { latitude: 33.58434, longitude: -101.87656 },
    canvasDomain: 'texastech.instructure.com', // verified: depts.ttu.edu/lms/student-faq.php
  },
];
export const COMING_SOON_NOTE = 'More campuses are on the way. Request yours and we\'ll prioritize the most-requested schools.';

/* Term dates — from TTU's official 2026-27 Academic Calendar at a
   Glance (tentative). Used for calendar-export recurrence end dates
   and the finals countdown. Update each term. */
export const TERM = {
  id: 'fall-2026',
  label: 'Fall 2026',
  firstDay: '2026-08-24',
  lastDay: '2026-12-02',
  finalsStart: '2026-12-04',
  finalsEnd: '2026-12-09',
  officialFinalsUrl: 'https://www.depts.ttu.edu/officialpublications/class_schedule/fall-common.php',
  calendarUrl: 'https://www.depts.ttu.edu/officialpublications/calendar/26-27_cal_glance.php',
};

/* When each kind of info was last checked against its official
   source. Shown as small "Checked …" labels; each has a "Looks wrong?"
   tap that sends a note to the Admin screen. Update these when you
   re-check a section (at least once a semester). null = no date shown. */
export const CHECKED = {
  hub: '2026-10-28', // data/hub.js: forms, money, health, dates
  safety: '2026-10-15', // TTPD contact page
  term: '2026-10-28', // 2026-27 academic calendar
  firstWeeks: '2026-11-02',
  roomCodes: '2026-10-28', // IT Help Central General Purpose Classrooms
  buildings: null,
  dining: null,
};

/* Verified on depts.ttu.edu/ttpd/contact.php (Oct 2026):
   one number serves admin, investigations, and 24/7 patrol. */
export const SAFETY = {
  emergency: '911',
  campusPolice: { label: 'Texas Tech Police (non-emergency, 24/7)', phone: '806-742-3931', source: 'https://www.depts.ttu.edu/ttpd/contact.php' },
};

/* Canvas "Sign in with Canvas" (OAuth2). Requires a Developer Key
   issued by whoever administers TTU's Canvas instance — only they
   can create one. Until you have it, leave clientId empty and the
   app shows manual assignment entry plus a "waiting on approval"
   card instead of a broken button. The client SECRET never goes in
   the app; it lives in the CANVAS_CLIENT_SECRET function secret. */
export const CANVAS = {
  clientId: '', // e.g. '170000000000123' from the Developer Key
  redirectScheme: 'flyer',
  redirectPath: 'canvas-auth',
};

/* Ads. Starts on Google's official TEST unit IDs so you can never
   accidentally click your own live ads (which gets AdMob accounts
   banned). Swap in your real IDs from admob.google.com before
   release, and set the app IDs in app.json's plugin config too. */
export const ADS = {
  enabled: true,
  useTestIds: true,
  bannerIos: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
  bannerAndroid: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
  nativeEvery: 6, // one ad slot per N feed items, never more
};

/* Flyer Plus via RevenueCat. Public SDK keys only. */
export const PURCHASES = {
  iosKey: '', // appl_xxxxxxxxx from RevenueCat
  androidKey: '', // goog_xxxxxxxxx
  entitlement: 'plus',
  priceHint: '$2.99/mo', // display only; real price comes from the store
};

/* Affiliate links. Must be disclosed (FTC) — the UI labels every
   affiliate link. Leave tag empty to show plain links instead. */
export const AFFILIATE = {
  amazonTag: '', // e.g. 'flyerapp-20'
};

/* Free-tier limits, enforced server-side in Cloud Functions; these
   copies are only for showing the user their remaining count. */
export const LIMITS = { pilotFree: 25, pilotPlus: 150, scansPerDay: 5 };

export const WIDGET_APP_GROUP = 'group.com.joshuat8808.flyer';

/* ---------- Flyer 2 ---------- */

/* Share links, QR codes, the TV page and universal links live on your
   Firebase Hosting site. If you add a custom domain later (for
   example flyer.eternityworks.dev), put it in `base`, add the old
   host to `altHosts`, and set SHARE_BASE in functions/.env too. */
export const SHARE = {
  base: 'https://raiderloop-98046.web.app',
  altHosts: ['raiderloop-98046.firebaseapp.com'],
  presentPath: '/present/',
  appStoreUrl: '', // fill in once Flyer is live, e.g. https://apps.apple.com/app/id1234567890
};

/* Connections. Each one is off (and says so) until its ID is filled
   in. None of these are secrets: phone apps use public client IDs with
   PKCE, and the Canva secret lives only in Cloud Functions.
   • Microsoft: Azure portal → App registrations → New (personal +
     work/school accounts) → Mobile and desktop platform, redirect
     msauth.com.joshuat8808.flyer://auth → copy the Application ID.
   • Google: Google Cloud console → Credentials → OAuth client ID →
     iOS, bundle com.joshuat8808.flyer → copy the client ID.
   • Canva: canva.com/developers → create an integration (Connect API),
     scopes design:meta:read, redirect <share site>/oauth/canva.
   • Text Flyer: the phone number you bought in Twilio (display only). */
export const CONNECTORS = {
  microsoftClientId: '',
  googleIosClientId: '',
  canvaClientId: '',
  textFlyerNumber: '',
};

/* Apple Wallet passes work once WALLET_ENABLED=true in functions/.env
   (see UPDATE notes). The app asks the server, so nothing to set here. */
