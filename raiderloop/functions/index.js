/**
 * Flyer Cloud Functions
 * ------------------------------------------------------------
 * Secrets (firebase functions:secrets:set NAME):
 *   ANTHROPIC_API_KEY       — already set from RaiderLoop
 *   TAVILY_API_KEY          — already set from RaiderLoop
 *   REVENUECAT_WEBHOOK_AUTH — any long random string; paste the same
 *                             value into RevenueCat's webhook settings
 *   CANVAS_CLIENT_SECRET    — only once TTU issues a Developer Key
 * Params (functions/.env):
 *   CANVAS_CLIENT_ID=        — from the same Developer Key
 *   DAILY_PAID_CALL_CAP=2500 — global daily ceiling on paid API calls
 *   ENFORCE_APP_CHECK=false  — set true once App Check is set up
 *
 * Storage: chat photos live in Firebase Storage (storage.rules).
 *
 * Every callable requires a signed-in user (guests are anonymous
 * Firebase users) and paid endpoints are limited per user per day.
 */
Object.assign(
  exports,
  require('./src/ai'), require('./src/social'), require('./src/canvas'),
  require('./src/places'), require('./src/chat'), require('./src/share'), require('./src/account'),
);
