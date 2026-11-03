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
src/screens/Home.js        friends' moments, weather, today timeline (free gaps, leave-now), due soon, tonight, a deal + a tip, first 30 days, season icon offer, headlines
src/screens/Discover.js    two lanes (Happening · Good to Know) + Explore: student/org posts, campus calendars, Around Lubbock, clubs, dining, sports
src/screens/Campus.js      map: buildings, Citibus, friends, layers (Postcards, events, deals, status); Map | Hub switch
src/screens/CampusHub.js   hub: "How do I…?" search; School (classes, Major Explorer, roadmap, missed class, office hours, syllabus); Getting around (rooms, Safe Walk); Life
src/data/hub.js            verified TTU links, numbers and 2026-27 dates for the hub
src/lib/seasons.js         seasonal theme calendar (remote.js lets you move dates live)
src/screens/Planner.js     Classes · Due · Week (busiest week, connected calendars) · Groups · GPA · Finals
src/screens/You.js         folder tabs: Me · Connect (card, QR, Say hi, Drops) · Play (Flight Score) · Settings
src/sheets/                every sheet (Connect, Drop, Say hi, Story, Groups, Plans, Rooms, Scan, Safe Walk, Play, Game, Present, Office hours, Missed class, Wellness, Explore, Connections, Privacy, Admin, Orgs…)
src/lib/                   firebase, notifications, calendar export, location, canvas, ads/plus, widget, hours, gpa
src/data/                  199 buildings, 508 orgs, 25 dining spots, 96 majors, football, resources
functions/                 Cloud Functions (AI, live data, social, Canvas, RevenueCat webhook)
firestore.rules            clients read only their own data + locations shared with them
targets/widget/            iOS widgets: home screen sticky note + lock screen "Leave now"
targets/imessage/          Flyer in Messages: plan polls + send saved events
extension/                 Chrome extension: student discounts and coupon codes
hosting/                   share-link pages, TV page for Present Mode, privacy, terms
docs/                      privacy policy, terms, App Store listing copy
```

## Feature status

| Feature | Status |
|---|---|
| Paper/notebook redesign, dark "chalkboard" mode, paper-airplane icon | ✅ Built |
| Onboarding with school picker + "Request your school" | ✅ Built |
| Real accounts (email, Sign in with Apple, guest), no university password | ✅ Built |
| Avatar creator | ✅ Built |
| Class reminders with weather heads-ups | ✅ Built |
| Assignments + reminders, GPA calculator, finals countdown | ✅ Built |
| Finals exam-time lookup | ✅ Built · fills in once TTU posts the by-class-time grid |
| Calendar export | ✅ Built |
| What's open near me, commuter parking, floor plans, safety numbers | ✅ Built |
| Friends (codes, requests, block), classmates (opt-in) | ✅ Built |
| Location sharing: friends-only, per-friend, quiet revoke, timed, ghost mode, campus-only, gameday | ✅ Built |
| Pilot (formerly Ask Red) with daily limits | ✅ Built |
| Greek life section | ✅ Built |
| Cost protection: auth required, per-user limits, global daily cap | ✅ Built |
| Ads (AdMob), Flyer Plus (RevenueCat), local sponsors, affiliate links | ✅ Built · needs your account keys |
| Canvas sign-in (OAuth) | ✅ Built · off until TTU issues a Developer Key |
| iOS home-screen widget | ✅ Built · needs an EAS build |
| Library printing status | ↪ Link to IT Help Central (no public live data exists) |
| Laundry availability | ✗ No TTU data source exists |
| Campus hub: Jobs Hub (boards, live openings, tracker, apply-once profile), Money, Forms, Health & Safety, Classes (catalog + study rooms), Tools (calculators), Student deals | ✅ Built (2.1) |
| Seasonal themes on an automatic calendar, plane outfits, washi tape, polaroids, graph/dot paper | ✅ Built (2.1) |
| Remote switches (Firestore config/app) | ✅ Built (2.1) |
| Connect card (QR, Apple Wallet), Say hi, Flyer Drop, friends-only moments + Story + College Journey, Postcards, Group Spaces, plans/polls | ✅ Built (2) |
| Report + block everywhere, automatic photo/text checks, admin review queue, verified org officers + poster QR | ✅ Built (2) |
| Share links with preview cards, "Checked" labels, What Flyer knows, room finder + floor guide, flyer scanner, syllabus drop | ✅ Built (2) |
| Lock screen widget, leave-now alerts, iMessage polls, Text Flyer | ✅ Built (2) · Text Flyer needs a Twilio number |
| Discover lanes, Flight Score + stamps + hunts + leaderboards, hide and seek, Present Mode, office hours line, missed-class kit, Safe Walk, seasonal app icons, Sleep & steps | ✅ Built (3) |
| Busiest week, roadmap, Major Explorer, first 30 days, status taps, offline copies, scrapbook, Connections (calendars, Microsoft, Google, Canva, Canvas token), Around Lubbock, browser extension | ✅ Built (3) · Microsoft/Google/Canva need their free developer IDs |
