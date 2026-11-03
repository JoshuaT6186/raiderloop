/**
 * Flyer Cloud Functions
 * ------------------------------------------------------------
 * Secrets (firebase functions:secrets:set NAME):
 *   ANTHROPIC_API_KEY       — already set from RaiderLoop
 *   TAVILY_API_KEY          — already set from RaiderLoop
 *   REVENUECAT_WEBHOOK_AUTH — any long random string; paste the same
 *                             value into RevenueCat's webhook settings
 *   CANVAS_CLIENT_SECRET    — only once TTU issues a Developer Key
 *   (optional, only when the matching *_ENABLED flag below is true)
 *   WALLET_SIGNER_CERT, WALLET_SIGNER_KEY, WALLET_SIGNER_PASSPHRASE, WALLET_WWDR
 *   TWILIO_AUTH_TOKEN, CANVA_CLIENT_SECRET
 * Params (functions/.env):
 *   CANVAS_CLIENT_ID=        — from the same Developer Key
 *   DAILY_PAID_CALL_CAP=2500 — global daily ceiling on paid API calls
 *   ENFORCE_APP_CHECK=false  — set true once App Check is set up
 *   SHARE_BASE=              — optional custom domain for share links
 *   APPLE_TEAM_ID=           — turns on universal links (and Wallet)
 *   APP_STORE_URL= / APP_STORE_ID= — once Flyer is live on the App Store
 *   WALLET_ENABLED=false, WALLET_PASS_TYPE_ID=
 *   TWILIO_ENABLED=false, TWILIO_ACCOUNT_SID=, TWILIO_NUMBER=
 *   CANVA_ENABLED=false, CANVA_CLIENT_ID=
 *
 * Every callable requires a signed-in user (guests are anonymous
 * Firebase users) and paid endpoints are limited per user per day.
 */
Object.assign(
  exports,
  require('./src/ai'), require('./src/social'), require('./src/canvas'), require('./src/hub'),
  require('./src/connect'), require('./src/posts'), require('./src/together'), require('./src/play'), require('./src/tools'), require('./src/web'),
);
