# Flyer 1.0: the full release (App Review fixes + batches 1, 2 and 3)

This is everything we planned, in one build, plus the three fixes Apple asked for. Same 5 tabs (Home, Discover, Campus, Planner, You), same paper look, with more paper.

---

## 1. App Review fixes (version 1.0, build 14)

| Apple's note | What changed |
|---|---|
| **2.1(a)** Continue with Apple showed an error | The Apple button only shows on devices that support it, uses Apple's own button, and any sign-in problem is logged to Admin → Errors so you can see exactly what failed. |
| **5.1.1(iv)** custom "Allow" button before the permission prompt | The pre-permission screen's button now says **Continue**. |
| **2.5.4** `UIBackgroundModes` had `location` | `plugins/withNoBackgroundLocation.js` strips it from the build. Flyer only uses location while the app is open. |

What to paste in **App Review Information → Notes** is in `docs/APP_STORE.md`.

---

## 2. What's new

### Home
- **Moments from friends** at the top (friends only, gone after 24 hours) with a camera button to post one.
- **Flight Score chip** next to your avatar.
- **Today as a timeline**: every class, the **free gaps** between them ("free 12:50–3:00 · 2h 10m", with "Lunch?" when it's lunchtime), and the next class opened up with **Leave in 6 min (9-minute walk from Holden Hall)**, Directions, **Find room 104**, and **Missed it?**
- **Tonight**: up to 3 things happening tonight, from student/org posts and campus calendars.
- **One deal and one Good to Know tip**, a new one each day.
- Cards that only show when they matter: **First 30 days** (with a progress bar), **the season's app icon** ("Want the Fall leaves icon?"), the **bedtime peek** the night before an early class, plus deadlines, finals and game day.
- Quick tools: Open now · Find a room · Safe Walk · Scan.

### Discover
- Two lanes: **Happening** (Right now posts, events from students and orgs, campus calendars, Around Lubbock) and **Good to Know** (tips that rise by "helpful", not likes). **Explore** keeps clubs, Greek life, food, sports and study spots.
- Post an event, a tip, or a "right now". **Scan a flyer** turns a photo of a poster into an event post.
- Confirmed **org officers** post as their org with an "Org" stamp and can print a **poster with a QR code**.

### Campus
- **Map layers** you can switch on and off: **Postcards** (friends' photos pinned to places, as tiny polaroids), **Events**, **Deals**, and **Status** (a ✓ or ! on buildings where students just tapped "elevator out", "seats full", etc).
- **Pin a Postcard** and **Find a room** in the drawer.
- **Hub**, now in three groups:
  - **School:** Classes, **Major Explorer**, **Roadmap** (your degree semester by semester), **Missed class**, **Office hours**, **Syllabus drop**
  - **Getting around:** **Find a room**, **Safe Walk**
  - **Life:** Jobs Hub, Money, Forms, Health & Safety, **Sleep & steps**, Student deals, Tools, **First 30 days**
- **"Checked Oct 28, 2026 · Looks wrong?"** labels on official info. "Looks wrong?" sends a note to your Admin screen.

### Room finder and floor guide (no official floor plans needed)
Type "HOLDEN 00104", "Holden Hall 104" or "MATH 012" and Flyer shows the building on the map, **which floor it's probably on**, a floor stack, the **doors students actually use** (photo tips from other students), and live **elevator / printer / seats / Wi-Fi** status. The SUB and Library still link to their public floor maps. If Flyer doesn't know a building code, you pick the building once and Flyer remembers it on your phone. Every building sheet now has **Find a room here** instead of the broken floor-plan link.

### Planner
Folder tabs: **Classes · Due · Week · Groups · GPA · Finals**
- **Classes:** each class has Directions, **Room**, **Missed it?**, and **Syllabus** (or **Office hours** once you've dropped in the syllabus). Events from your connected calendars show under each day.
- **Week:** the **busiest week** chart for the whole semester (exams and projects count more), a few kind suggestions ("the week of Oct 12 looks like a crunch, start a little early"), and the next 7 days from your connected calendars.
- **Groups:** **Group Spaces** for every project: shared deadlines, tasks, files and links (OneDrive and Canva too), a "when is everyone free" finder, polls, Present Mode, and a face-photo swap so teammates can recognize each other.
- **Syllabus drop:** every exam and assignment date goes into Due, plus the instructor and office hours.

### You
Folder tabs on kraft paper: **Me · Connect · Play · Settings**
- **Me:** profile, friends, My Story, Groups, Semester scrapbook, Sleep & steps, Plus, saved.
- **Connect:** **your one Connect card** (choose Everyone / Friends / Hidden for each part), **My QR** with **Add to Apple Wallet**, Scan someone, **Say hi** (people who share a class or org and opted in), your **Drops** inbox.
- **Play:** **Flight Score**, rubber **stamps**, **scavenger hunts** (objects and places only), **leaderboards** (friends, campus if you opt in, orgs), and **hide and seek**.
- **Settings:** look, seasonal themes, **app icon**, reminders (now with **Leave-now alerts** and **Bedtime nudge**), **notifications from people** (Say hi, Drops, groups, plans, office hours, games), **What Flyer knows**, **Connections**, First 30 days, **Org officers**, and **Admin** (only you see it).

### People
- **Flyer Drop:** send your card, a link, note, photo, PDF, event, or group invite to a friend, to someone next to you (both on the Drop screen), or to anyone who scans your QR. When one lands while Flyer is open, a **paper plane flies in** with a little note.
- **Moments, Story, College Journey, Postcards:** photos are friends-only. Moments leave feeds after 24 hours and the ones you save stay in your Story. Your College Journey is everything you've posted, by semester.
- **Plans and polls** your friends can vote on even without the app (the link opens a voting page).
- **Report and block** on every post, card, Drop, group, intro, and shared link.
- **Moderation:** every photo and post is checked automatically before anyone sees it. Unsure ones are **held for you** in Admin → Held. 3 reports hide a Discover post until you look.

### Together
- **Safe Walk:** pick friends, pick where you're going, and they get a ping if you don't check in. SOS sends your last spot to them. (Not an emergency service; it says so.)
- **Office hours line:** the TA opens a line, students join with a code or QR, and get a push when it's their turn.
- **Present Mode:** open `raiderloop-98046.web.app/present` on a classroom TV, type its code in Flyer, and show group files from your phone.
- **Missed-class kit:** what was due, notes classmates shared (opt-in), and "ask what I missed".

### Everywhere else
- **Share to Messages** makes a short link with a real preview card (title, time, place, picture). Friends with Flyer land right on it.
- **Flyer in Messages:** in any iMessage chat, open the Flyer app drawer to send a **plan poll** (everyone taps to vote and the bubble updates) or one of your saved events. Today's free gaps are suggested as poll options.
- **Lock screen widgets:** "Leave now" with a live countdown (inline, circular and rectangular sizes). The home screen widget shows the leave time too.
- **Text Flyer:** text a number and Pilot answers from your schedule and due dates. Only that short summary is shared, and only while it's on.
- **Connections:** calendar links (Canvas, Outlook, Google, club calendars), Microsoft (OneDrive files + calendar), Google Calendar, Canva designs, Apple Health, Text Flyer, and under **Advanced**, a Canvas access token. Keys stay in the iPhone Keychain.
- **Sleep & steps** from Apple Health (works with Apple Watch, Fitbit, Oura, Garmin through Health). Read on the phone only. No calories, no weight, no streaks.
- **Seasonal app icons:** Fall leaves, Winter lights, New Year, Valentine's, St. Patrick's. Flyer offers the switch on Home; it never changes your icon by itself.
- **Offline:** headlines, events, deals and Around Lubbock keep a saved copy, so Flyer still shows something in a basement classroom.
- **What Flyer knows:** every kind of data Flyer has about you, with delete buttons.
- **Browser extension** (`extension/`): checks the store you're on for a student discount or a current coupon code, with sources.

### The paper look, a little more paper
Different paper per tab (lined Home, dot-grid Discover, graph-paper Campus hub and Planner, kraft-paper You), washi tape and push pins on cards, polaroid Postcards, rubber stamps for Flight Score, a highlighter swipe on big numbers, folder tabs everywhere, a soft fade-up when pages open, and the paper plane landing for Drops. All motion stops when the phone's Reduce Motion is on.

---

## 3. Install

### a) Before you copy anything
Open your current `app.json` and copy your real **`extra.eas.projectId`** somewhere. The zip has a placeholder.

### b) Copy the folder over your project
`package.json`, `node_modules` and `.git` aren't in the zip, so they stay. Then paste your real `projectId` back into `app.json`.

`app.json` now says version **1.0.0**, which matches the 1.0 record App Store Connect already has. EAS bumps the build number for you.

### c) New packages (one command)
```bash
npx expo install expo-camera expo-image-manipulator expo-document-picker expo-secure-store expo-keep-awake expo-clipboard expo-constants expo-auth-session expo-crypto expo-alternate-app-icons @kingstinct/react-native-healthkit react-native-nitro-modules
npm install qrcode-generator
```
`npx expo install` skips anything you already have and picks versions that match your Expo SDK.

### d) Backend
```bash
cd functions && npm install && cd ..
firebase deploy --only firestore:rules,firestore:indexes,storage
firebase deploy --only functions
firebase deploy --only hosting
```
If the indexes deploy says some are still building, wait a few minutes before testing Discover and the map layers.

Then make yourself an admin: Firestore → **config → app** → add a field `admins` (array) with your user ID (Authentication → Users → copy the User UID).

### e) Apple Developer setup (once)
1. **Identifiers** → your app ID `com.joshuat8808.flyer` → turn on **HealthKit**, **App Groups** (`group.com.joshuat8808.flyer`) and **Associated Domains**.
2. EAS creates the two extension IDs for you on the next build (`…flyer.widget` and `…flyer.imessage`). If it asks, say yes to creating them and to adding the App Group.
3. In `functions/.env`, add your Team ID so share links open the app directly:
   ```
   APPLE_TEAM_ID=YOUR10CHARID
   ```
   (developer.apple.com → Membership → Team ID.) Redeploy functions after.

### f) Build and submit
```bash
eas build -p ios --profile production
eas submit -p ios --latest
```
Use the review notes in `docs/APP_STORE.md`.

---

## 4. Optional switches (each one is off and says "not set up yet" until you do it)

All of these go in `functions/.env` (settings) or Secret Manager (secrets), then `firebase deploy --only functions`.

**Apple Wallet card**
1. developer.apple.com → Identifiers → **Pass Type IDs** → add `pass.com.joshuat8808.flyer` → make a certificate.
2. Export it from Keychain as a .p12, then convert:
   ```bash
   openssl pkcs12 -in pass.p12 -clcerts -nokeys -out signerCert.pem -legacy
   openssl pkcs12 -in pass.p12 -nocerts -out signerKey.pem -legacy
   ```
   Download Apple's **WWDR G4** certificate and convert it to `wwdr.pem`.
3. Secrets: `firebase functions:secrets:set WALLET_SIGNER_CERT < signerCert.pem` (same for `WALLET_SIGNER_KEY`, `WALLET_WWDR`, and `WALLET_SIGNER_PASSPHRASE`, which can be `none`).
4. `.env`: `WALLET_ENABLED=true` and `WALLET_PASS_TYPE_ID=pass.com.joshuat8808.flyer`

**Text Flyer** (a Twilio number costs a few dollars a month, plus a fraction of a cent per text)
1. Twilio → buy a number → Messaging webhook: `https://raiderloop-98046.web.app/sms` (HTTP POST).
2. Secret: `TWILIO_AUTH_TOKEN`. `.env`: `TWILIO_ENABLED=true`, `TWILIO_ACCOUNT_SID=AC…`, `TWILIO_NUMBER=+1…`
3. Put the same number in `src/config.js` → `CONNECTORS.textFlyerNumber`.
US numbers need A2P 10DLC registration in Twilio before texts go through. Use your LLC.

**Microsoft** (OneDrive files in groups, Outlook calendar): Azure portal → App registrations → New → "Accounts in any organizational directory and personal Microsoft accounts" → Platform **iOS/macOS**, bundle ID `com.joshuat8808.flyer` (the redirect `msauth.com.joshuat8808.flyer://auth` is already in `app.json`). Copy the Application (client) ID into `CONNECTORS.microsoftClientId`. TTU's Microsoft tenant may ask an admin to approve; personal accounts work right away.

**Google Calendar:** Google Cloud console → Credentials → OAuth client ID → **iOS**, bundle ID `com.joshuat8808.flyer`. Put the client ID in `CONNECTORS.googleIosClientId`, and add its reversed form (`com.googleusercontent.apps.…`) to the `scheme` list in `app.json`. Needs a rebuild.

**Canva:** canva.com/developers → create an integration → redirect URL `https://raiderloop-98046.web.app/oauth/canva`, scope `design:meta:read`. Client ID in `CONNECTORS.canvaClientId` and `.env` (`CANVA_CLIENT_ID`, `CANVA_ENABLED=true`), secret as `CANVA_CLIENT_SECRET`.

**App Store link on share pages** (after you're live): `.env` → `APP_STORE_URL=https://apps.apple.com/app/id…` and `APP_STORE_ID=…`, and `src/config.js` → `SHARE.appStoreUrl`.

**Browser extension:** see `extension/README.md` (load it unpacked in Chrome to try it; $5 one-time to publish).

---

## 5. Your weekly jobs (App Review cares about these)
- **Check Admin within 24 hours of a report.** Your terms now promise it, and Apple requires it for apps with posts. You get a push for every new report.
- Approve **org officer** requests (Admin → Orgs) after checking TechConnect or the org's email.
- Add deals students suggest (Admin → Deals) once you've checked them.
- Each semester: update `TERM` in `src/config.js` and the `CHECKED` dates when you re-check official info.

---

## 6. Test checklist
- [ ] Apple sign-in on a real iPhone, then You → Settings shows "Signed in"
- [ ] Permissions screen button says **Continue**
- [ ] Home: timeline with a free gap, "Leave in…" before a class in a different building, Find room
- [ ] Rooms: type `HOLDEN 00104` → Holden Hall, probably floor 1
- [ ] You → Connect → My QR → scan it with the iPhone Camera app → the link opens your card
- [ ] Flyer Drop a note to a second account with both apps open (the plane flies in)
- [ ] Post a moment, then see it from the friend's Home
- [ ] Make a group, add a deadline, make a poll, vote from the web link on a laptop
- [ ] Safe Walk with a friend as the watcher, let the timer run out → they get a ping
- [ ] Office hours: open a line on one phone, join from another, tap Next
- [ ] Messages → app drawer → Flyer → Plan poll → vote from the other phone
- [ ] Lock screen → customize → add Flyer "Leave now"
- [ ] Settings → app icon → Fall leaves
- [ ] Sleep & steps → Continue → Health permission sheet → numbers show
- [ ] Report a post from the second account → push to you → Admin → Remove content
- [ ] Airplane mode → Home still shows headlines (saved copy)
- [ ] Dark mode (Chalkboard) on the new screens

---

## 7. Checked before sending
- Every app, extension and Cloud Functions file was linted (no undefined names, no hook mistakes) and every import was matched to a real export.
- **135 render tests**: every screen in light and dark mode and all 5 seasons, **every new sheet opened through the real sheet router (44 openings)**, texted links and push taps routing to the right sheet, and the helpers (leave-now walk times, bedtime math, busiest week, room finder, deep links, first 30 days, the Text Flyer summary). All passed.
- **All 128 Cloud Functions load** with Wallet, Twilio and Canva switched on. The Apple Wallet pass builds and signs with test certificates. The Messages poll web page was tested, including escaping.
- **Not test-compiled here:** the Swift for the widgets and the Messages extension (that needs a Mac or the EAS build). It uses standard WidgetKit, SwiftUI and Messages code for iOS 17. If the EAS build log shows a Swift error, send it to me and I'll fix it right away.

## 8. Honest limits
- **Room floors are a best guess** from the room number ("probably floor 1"), because there are no public TTU floor plans except the SUB and Library. Door tips get better as students add them.
- **Building codes:** only 5 are confirmed from TTU (AGRI, HUMSCI, HOLDEN, MATH, SCIENCE). Others match by name, and students can teach Flyer a code once on their phone.
- **Canvas token** is under Advanced on purpose. Instructure discourages apps from asking for tokens, so Flyer never prompts for it, and the calendar-feed link is the recommended way.
- **Nearby Drop and hide and seek** only work while the app is open on both phones. iPhones don't let apps use AirDrop or phone-to-phone taps.
- **Text Flyer, Wallet, Microsoft, Google and Canva** need the free (or cheap) accounts above before they turn on.
