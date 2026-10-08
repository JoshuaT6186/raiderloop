# Flyer ✈︎

Your campus, folded into one app. An independent, student-built app by Eternity Works (formerly RaiderLoop). Setup steps are in **SETUP.md**.

## Where everything lives

```
App.js                     fonts → state → theme → Shell
src/config.js              every key, URL, term date, limit (start here)
src/Shell.js               tabs, Pilot button, all sheets, background jobs
src/theme/                 Notebook (light) + Chalkboard (dark) tokens
src/ui/Paper.js            post-its, tape, index cards, torn-edge sheets, chips…
src/ui/Avatar.js           doodle avatar renderer (+ avatarParts.js options)
src/ui/Logo.js             paper-airplane mark
src/screens/onboarding/    welcome → account → school → profile → avatar → interests → schedule → permissions → tour
src/screens/Home.js        weather, up next, due soon, quick tools, game day, headlines
src/screens/Discover.js    events, sponsors, clubs "for you", Greek life, dining, sports, study, links, textbooks
src/screens/Campus.js      map: buildings, Citibus, friends' avatars; drawer with tools
src/screens/Planner.js     Classes · Due · GPA · Finals
src/screens/You.js         profile, friends, Plus, saved, settings, sign out, delete account
src/sheets/                Pilot, Friends (+ sharing), details, campus tools, forms
src/lib/                   firebase, notifications, calendar export, location, ads/plus, widget, hours, gpa
src/data/                  199 buildings, 508 orgs, 25 dining spots, 96 majors, football, resources
functions/                 Cloud Functions (AI, live data, social, Canvas, RevenueCat webhook)
firestore.rules            clients read only their own data + locations shared with them
targets/widget/            iOS home-screen widget (WidgetKit)
docs/                      privacy policy, terms, App Store listing copy
```

## Feature status

| Feature | Status |
|---|---|
| Paper/notebook redesign, dark "chalkboard" mode, paper-airplane icon | ✅ Built |
| Onboarding with school picker + "Request your school" | ✅ Built |
| Real accounts (email, Sign in with Apple, guest) — no university password | ✅ Built |
| Avatar creator | ✅ Built |
| Class reminders with weather heads-ups | ✅ Built |
| Assignments + reminders, GPA calculator, finals countdown | ✅ Built |
| Finals exam-time lookup | ✅ Built — fills in once TTU posts the by-class-time grid |
| Calendar export | ✅ Built |
| What's open near me, commuter parking, floor plans, safety numbers | ✅ Built |
| Friends (codes, requests, block) | ✅ Built |
| Location sharing: friends-only, per-friend, quiet revoke, timed, ghost mode, campus-only, gameday | ✅ Built |
| Pilot (formerly Ask Red) with daily limits | ✅ Built |
| Greek life section | ✅ Built |
| Cost protection: auth required, per-user limits, global daily cap | ✅ Built |
| Ads (AdMob), Flyer Plus (RevenueCat), local sponsors, affiliate links | ✅ Built — needs your account keys |
| iOS home-screen widget | ✅ Built — needs an EAS build |
| Library printing status | ↪ Link to IT Help Central (no public live data exists) |
| Laundry availability | ✗ No TTU data source exists |
