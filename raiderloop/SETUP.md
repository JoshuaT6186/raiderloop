# Flyer — setup & launch guide

Flyer replaces RaiderLoop. It's a multi-file Expo project now, so instead of pasting one big `App.jsx`, you copy a folder.

## 1. Put the code in your repo

In your Codespace, from the root of your existing Expo project:

```bash
# keep your package.json, node_modules and .git — replace the app code
rm -f App.jsx App.js index.jsx
# unzip flyer.zip here, then copy everything except node_modules:
cp -r flyer/App.js flyer/src flyer/assets flyer/targets flyer/functions \
      flyer/app.json flyer/eas.json flyer/firebase.json \
      flyer/firestore.rules flyer/firestore.indexes.json .
```

Your `package.json` must have `"main": "node_modules/expo/AppEntry.js"` (or an `index.js` that registers `./App`).

## 2. Install packages

`npx expo install` picks versions that match your Expo SDK:

```bash
npx expo install react-native-svg react-native-maps react-native-safe-area-context \
  expo-font expo-image-picker expo-notifications expo-location expo-calendar expo-haptics \
  expo-auth-session expo-web-browser expo-crypto expo-apple-authentication \
  expo-tracking-transparency expo-dev-client @react-native-async-storage/async-storage \
  @expo-google-fonts/nunito @expo-google-fonts/caveat @expo-google-fonts/permanent-marker \
  react-native-google-mobile-ads react-native-purchases @bacons/apple-targets firebase
```

Ads, purchases, and the widget are native modules, so **Expo Go can't run the full app**. Use EAS builds, which you already do. Every native module is loaded defensively, though, so in Expo Go the rest of the app still opens and those features say they aren't available.

## 3. New app identity (do this before App Store Connect)

The bundle ID is now `com.joshuat8808.flyer`. **It can't be changed after you create the App Store listing**, so double-check it in `app.json` first.

```bash
eas init            # creates a new EAS project and writes its id into app.json
```

This is a new app, not an update to RaiderLoop. Your TestFlight testers will need a new invite.

## 4. Firebase (same project as before)

`src/config.js` still points at `raiderloop-98046`, so your existing secrets and cache carry over.

1. **Turn on sign-in methods.** Firebase console → Authentication → Sign-in method → enable **Email/Password**, **Anonymous**, and **Apple**. For Apple, follow the console's steps (Services ID + key from your Apple Developer account).
2. **Deploy rules, indexes, and functions:**
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   firebase functions:secrets:set REVENUECAT_WEBHOOK_AUTH   # any long random string
   cd functions && npm install && cd ..
   firebase deploy --only functions
   ```
   `askRed` is still deployed, so the old RaiderLoop TestFlight build keeps working until people switch.
3. **Set spending limits.** Do this now, not later:
   - console.anthropic.com → Limits → set a monthly spend limit
   - Tavily dashboard → plan / usage cap
   - Google Cloud console → Billing → Budgets & alerts → add a budget with email alerts

   The functions add two more layers. Each user gets 25 Pilot questions, 5 scans, and 80 live lookups per day (150 Pilot questions with Plus). There's also a global ceiling of 2,500 paid API calls per day, which you can change in `functions/.env`.

### Optional: App Check
App Check blocks requests that don't come from your real app. It needs the native Firebase SDK (`@react-native-firebase/app-check`), which is a bigger change, so it's off for now. Auth plus per-user limits cover the main risk. When you add it, set `ENFORCE_APP_CHECK=true` in `functions/.env` and redeploy.

## 5. Things that need your accounts

Each of these is coded and switched off until you add the key. The app shows an honest "not set up yet" state, never a broken button.

| Feature | Where to set it | Status until then |
|---|---|---|
| **Ads (AdMob)** | Create the app at admob.google.com. Put the app IDs in `app.json` (`react-native-google-mobile-ads` plugin) and the banner IDs in `src/config.js` → `ADS`. Set `useTestIds: false` **only** in the release build. | Shows Google's test ads |
| **Flyer Plus (RevenueCat)** | Create the subscription in App Store Connect, then an entitlement called `plus` and an offering in RevenueCat. Paste the public SDK key into `src/config.js` → `PURCHASES.iosKey`. Webhook URL = your `revenuecatWebhook` function URL, with the Authorization header set to the `REVENUECAT_WEBHOOK_AUTH` value. | Plus card says purchases aren't set up |
| **Local sponsors** | Firestore → `sponsors` collection. Add docs like `{ name, offer, url, color: "green", schoolId: "ttu", active: true, startsAt, endsAt }`. | Nothing shown |
| **Affiliate links** | `src/config.js` → `AFFILIATE.amazonTag` once you're approved for Amazon Associates | Plain links with no tag |
| **Canvas sign-in** | Needs a Developer Key from TTU's Canvas admins. Put the client ID in `src/config.js` → `CANVAS.clientId` **and** `functions/.env` → `CANVAS_CLIENT_ID`, then `firebase functions:secrets:set CANVAS_CLIENT_SECRET`. Redirect URI to give them: `flyer://canvas-auth` | "Waiting on approval" card; manual assignments work fully |
| **Support email / privacy URL** | `src/config.js` → `APP` | Placeholders — **must** be real before you submit |

## 6. Host the privacy policy and terms

Apple requires a public privacy policy URL. The quickest route is to push `docs/privacy.html` and `docs/terms.html` to a GitHub repo, turn on GitHub Pages, and paste the URLs into `src/config.js` and App Store Connect.

## 7. Home-screen widget

`targets/widget` is a WidgetKit extension built by `@bacons/apple-targets`. The App Group `group.com.joshuat8808.flyer` must exist in your Apple Developer account. EAS normally creates it for you on the first build; if the build complains, add it under Certificates, Identifiers & Profiles → App Groups.

## 8. Build & ship

```bash
eas build -p ios --profile production
eas submit -p ios
```

Suggested rollout: a **public TestFlight link** first (up to 10,000 testers, lighter review) for SGA to share, then the full App Store.

## 9. Before you submit — checklist
- [ ] Real support email and hosted privacy/terms URLs in `src/config.js`
- [ ] Spending caps set on Anthropic, Tavily, and Google Cloud
- [ ] `ADS.useTestIds` set to false with your real AdMob IDs (release only)
- [ ] App Store privacy "nutrition label" filled in to match `docs/privacy.html` (see `docs/APP_STORE.md`)
- [ ] New screenshots taken from the Flyer build
- [ ] Name search done: App Store + USPTO TESS for "Flyer" in software classes
