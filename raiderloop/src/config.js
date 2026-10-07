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
  supportEmail: 'support@eternityworks.app', // TODO: replace with a real inbox you check
  privacyUrl: 'https://YOUR-GITHUB-USERNAME.github.io/flyer/privacy.html', // TODO: host docs/privacy.html
  termsUrl: 'https://YOUR-GITHUB-USERNAME.github.io/flyer/terms.html', // TODO: host docs/terms.html
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
