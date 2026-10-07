/**
 * RaiderLoop — single-file prototype
 * -----------------------------------------------------------
 * Expo / React Native. No external dependencies.
 * Drop this in as App.js and run `npx expo start`.
 *
 * All data below is placeholder. Nothing here talks to a real
 * campus system yet — see PLACEHOLDER DATA to swap in real feeds.
 */

import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Platform,
  Modal,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');

/* ============================================================
   THEME — RaiderFlow tokens
   ============================================================ */

const RED = '#C4122F';
const RED_SOFT = '#E4405C';

const lightTheme = {
  mode: 'light',
  canvas: '#FBF7F4',        // warm canvas
  surface: '#FFFFFF',
  surfaceAlt: '#F5EFEA',
  border: 'rgba(28,22,20,0.08)',
  text: '#1A1517',
  textMuted: '#6B6058',
  red: RED,
  redSoft: RED_SOFT,
  onRed: '#FFFFFF',
  navBg: 'rgba(251,247,244,0.96)',
};

const darkTheme = {
  mode: 'dark',
  canvas: '#131011',
  surface: '#1E1A1B',
  surfaceAlt: '#252021',
  border: 'rgba(255,255,255,0.10)',
  text: '#F6F1EF',
  textMuted: '#9E9490',
  red: '#E3253F',
  redSoft: '#FF5C74',
  onRed: '#FFFFFF',
  navBg: 'rgba(19,16,17,0.96)',
};

/* ============================================================
   PLACEHOLDER DATA — replace with real feeds later
   ============================================================ */

const LOOP_CARDS = [
  {
    id: 'l1',
    eyebrow: 'FOR YOU',
    title: 'Game Development Club',
    time: 'Tonight · 7:00 PM',
    place: 'Engineering Center',
    reason: 'Matches your interests',
    cta: 'View event',
    flow: 2,
  },
  {
    id: 'l2',
    eyebrow: 'STARTING SOON',
    title: 'Intramural Basketball',
    time: 'Today · 6:00 PM',
    place: 'Rec Center',
    reason: 'Starts in 45 minutes',
    cta: 'View event',
    flow: 2,
  },
  {
    id: 'l3',
    eyebrow: 'POPULAR',
    title: 'Study Abroad Info Session',
    time: 'Tomorrow · 12:00 PM',
    place: 'Student Union',
    reason: 'Popular this week',
    cta: 'View event',
    flow: 1,
  },
];

const TODAY_EVENTS = [
  { id: 'e1', month: 'AUG', day: '29', title: 'Game Night', time: '7:00 PM', place: 'Engineering Center', cat: 'Gaming' },
  { id: 'e2', month: 'AUG', day: '29', title: 'Live Music', time: '8:00 PM', place: 'Student Union', cat: 'Music' },
  { id: 'e3', month: 'AUG', day: '29', title: 'Pickup Basketball', time: '6:00 PM', place: 'Rec Center', cat: 'Sports' },
  { id: 'e4', month: 'AUG', day: '30', title: 'Coffee & Code', time: '10:00 AM', place: 'Library', cat: 'Technology' },
];

const NEARBY = [
  { id: 'p1', name: 'The Commons', kind: 'Dining', dist: '4 min away', open: true },
  { id: 'p2', name: 'Library', kind: 'Study space', dist: '5 min away', open: true },
  { id: 'p3', name: 'Student Union', kind: 'Dining · Study', dist: '3 min away', open: true },
  { id: 'p4', name: 'Rec Center', kind: 'Recreation', dist: '8 min away', open: false },
];

const OFFICIAL = {
  id: 'o1',
  title: 'Blackout Game',
  subtitle: 'Red Raiders vs. Oklahoma State',
  date: 'Sat, Nov 16 · 6:00 PM',
  place: 'Jones AT&T Stadium',
  body: 'Wear black. Be loud. Support your Red Raiders under the lights.',
};

const RECOMMENDED = [
  { id: 'r1', name: 'Game Development Club', tags: 'Technology · Gaming', reason: 'Because you like Technology' },
  { id: 'r2', name: 'Entrepreneurship Club', tags: 'Business · Innovation', reason: 'Popular with CS students' },
  { id: 'r3', name: 'Student Organization Fair', tags: 'Campus · September 3', reason: 'Happening soon' },
];

const SCHEDULE_TODAY = [
  { id: 's1', time: '9:00 AM', title: 'MATH 1451', place: 'Holden Hall 101', type: 'class' },
  { id: 's2', time: '10:30 AM', title: 'Study Break', place: 'Student Union', type: 'personal' },
  { id: 's3', time: '1:00 PM', title: 'CS 1412', place: 'Engineering Center 101', type: 'class' },
  { id: 's4', time: '7:00 PM', title: 'Game Development Club', place: 'Engineering Center', type: 'event' },
];

const BUILDINGS = [
  { id: 'b1', name: 'Engineering Center', kind: 'Academic building', dist: '4 min walk' },
  { id: 'b2', name: 'Holden Hall', kind: 'Academic building', dist: '3 min walk' },
  { id: 'b3', name: 'Student Union', kind: 'Student life', dist: '3 min walk' },
  { id: 'b4', name: 'Library', kind: 'Library · Study', dist: '5 min walk' },
  { id: 'b5', name: 'Rec Center', kind: 'Recreation', dist: '8 min walk' },
];

const INTERESTS = [
  'Sports', 'Music', 'Arts', 'Technology', 'Gaming',
  'Career', 'Faith', 'Academics', 'Campus Events',
];

const DISCOVER_CATEGORIES = [
  { id: 'c1', title: 'Things to Do', sub: 'Events, activities & athletics' },
  { id: 'c2', title: 'Get Involved', sub: 'Organizations & opportunities' },
  { id: 'c3', title: 'Places', sub: 'Food, coffee & places to explore' },
  { id: 'c4', title: 'Get Help', sub: 'Tutoring, resources & support' },
];

/* Canned Ask Red replies. Real version would hit a model + your data layer. */
const RED_REPLIES = [
  {
    match: ['tonight', 'happening', 'fun', 'do'],
    text: '3 things you might like tonight',
    results: [
      { title: 'Game Night', meta: '7:00 PM · Engineering Center' },
      { title: 'Live Music', meta: '8:00 PM · Student Union' },
      { title: 'Pickup Basketball', meta: '6:00 PM · Rec Center' },
    ],
  },
  {
    match: ['class', 'next class', 'where'],
    text: 'Your next class is CS 1412 in the Engineering Center.',
    results: [{ title: 'Engineering Center', meta: '6 min walk · Room 101' }],
  },
  {
    match: ['eat', 'food', 'hungry', 'lunch'],
    text: "Here's what's open near you right now.",
    results: [
      { title: 'The Commons', meta: 'Dining · 4 min away' },
      { title: 'Student Union', meta: 'Dining · 3 min away' },
    ],
  },
  {
    match: ['study', 'quiet', 'library'],
    text: 'Two study spots close to you.',
    results: [
      { title: 'Library', meta: 'Open until 10 PM · 5 min away' },
      { title: 'Student Union', meta: 'Open until 8 PM · 3 min away' },
    ],
  },
];

const RED_SUGGESTIONS = [
  "What's happening tonight?",
  'Where is my next class?',
  'Where can I eat?',
  'Where can I study?',
];

/* ============================================================
   RAIDERFLOW — ambient color diffusion
   Layered translucent circles stand in for a real gradient so
   this runs with zero extra packages.
   ============================================================ */

const FLOW_ORIGINS = {
  topRight: { top: -70, right: -50 },
  topLeft: { top: -70, left: -50 },
  bottomRight: { bottom: -70, right: -50 },
  bottomLeft: { bottom: -70, left: -50 },
  center: { top: '25%', left: '25%' },
};

/** intensity: 0 none · 1 whisper · 2 presence · 3 focus */
function Flow({ intensity = 1, origin = 'topRight', color, size = 190 }) {
  if (!intensity) return null;
  const base = { 1: 0.06, 2: 0.14, 3: 0.24 }[intensity] || 0.06;
  const pos = FLOW_ORIGINS[origin] || FLOW_ORIGINS.topRight;
  const rings = [
    { s: size, o: base * 0.5 },
    { s: size * 0.72, o: base * 0.8 },
    { s: size * 0.45, o: base },
  ];
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {rings.map((r, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            ...pos,
            width: r.s,
            height: r.s,
            borderRadius: r.s / 2,
            backgroundColor: color,
            opacity: r.o,
          }}
        />
      ))}
    </View>
  );
}

/* ============================================================
   SMALL SHARED PIECES
   ============================================================ */

function SectionHeader({ s, t, label, action, onAction }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionLabel}>{label}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={s.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SearchField({ s, t, placeholder, value, onChangeText }) {
  return (
    <View style={s.search}>
      <Text style={s.searchIcon}>⌕</Text>
      <TextInput
        style={s.searchInput}
        placeholder={placeholder}
        placeholderTextColor={t.textMuted}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

function Pill({ s, t, label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.pill, active && { backgroundColor: t.red, borderColor: t.red }]}
    >
      <Text style={[s.pillText, active && { color: t.onRed }]}>{label}</Text>
    </Pressable>
  );
}

/* Brand mark — placeholder loop glyph. Swap for real branding. */
function Mark({ t, size = 26 }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2.5,
        borderColor: t.red,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: size * 0.3,
          height: size * 0.3,
          borderRadius: size * 0.15,
          backgroundColor: t.red,
        }}
      />
    </View>
  );
}

/* ============================================================
   HOME
   ============================================================ */

function HomeScreen({ s, t, goTo }) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.screenContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={s.brandRow}>
        <Mark t={t} size={22} />
        <Text style={s.brandText}>
          RAIDER<Text style={{ color: t.red }}>LOOP</Text>
        </Text>
      </View>

      <Text style={s.greeting}>{greeting}, Joshua 👋</Text>
      <Text style={s.greetingSub}>Here's what's happening around you.</Text>

      <SearchField s={s} t={t} placeholder="Search RaiderLoop" />

      <SectionHeader s={s} t={t} label="YOUR LOOP" action="See all" />
      <Text style={s.sectionSub}>Things worth knowing right now.</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SCREEN_W * 0.78 + 12}
        decelerationRate="fast"
        contentContainerStyle={{ paddingRight: 20 }}
        style={{ marginHorizontal: -20, paddingHorizontal: 20 }}
      >
        {LOOP_CARDS.map((c) => (
          <View key={c.id} style={s.heroCard}>
            <Flow intensity={c.flow} origin="bottomRight" color={t.red} size={200} />
            <Text style={s.heroEyebrow}>★ {c.eyebrow}</Text>
            <Text style={s.heroTitle}>{c.title}</Text>
            <Text style={s.heroMeta}>{c.time}</Text>
            <Text style={s.heroMeta}>{c.place}</Text>
            <Text style={s.heroReason}>{c.reason}</Text>
            <Pressable style={s.heroBtn}>
              <Text style={s.heroBtnText}>{c.cta} →</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      <SectionHeader s={s} t={t} label="HAPPENING TODAY" action="See all" onAction={() => goTo('discover')} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 20 }}
        style={{ marginHorizontal: -20, paddingHorizontal: 20 }}
      >
        {TODAY_EVENTS.map((e) => (
          <Pressable key={e.id} style={s.eventCard}>
            <Flow intensity={1} origin="topRight" color={t.red} size={110} />
            <Text style={s.eventDate}>{e.month} {e.day}</Text>
            <Text style={s.eventTitle}>{e.title}</Text>
            <Text style={s.eventMeta}>{e.time}</Text>
            <Text style={s.eventMeta}>{e.place}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <SectionHeader s={s} t={t} label="AROUND YOU" action="See all" onAction={() => goTo('campus')} />
      {NEARBY.slice(0, 3).map((p) => (
        <Pressable key={p.id} style={s.rowCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>{p.name}</Text>
            <Text style={s.rowMeta}>{p.kind} · {p.dist}</Text>
          </View>
          <Text style={[s.rowStatus, !p.open && { color: t.textMuted }]}>
            {p.open ? 'Open' : 'Closed'}
          </Text>
        </Pressable>
      ))}

      <SectionHeader s={s} t={t} label="OFFICIAL TTU" />
      <View style={s.officialCard}>
        <Flow intensity={2} origin="topLeft" color={t.red} size={190} />
        <View style={s.officialBadge}>
          <Text style={s.officialBadgeText}>OFFICIAL</Text>
        </View>
        <Text style={s.officialTitle}>{OFFICIAL.title}</Text>
        <Text style={s.rowMeta}>{OFFICIAL.subtitle}</Text>
        <Text style={[s.rowMeta, { marginTop: 8 }]}>{OFFICIAL.date}</Text>
        <Text style={s.rowMeta}>{OFFICIAL.place}</Text>
        <Text style={s.officialBody}>{OFFICIAL.body}</Text>
        <Pressable style={s.primaryBtn}>
          <Text style={s.primaryBtnText}>View details</Text>
        </Pressable>
      </View>

      <SectionHeader s={s} t={t} label="RECOMMENDED FOR YOU" />
      {RECOMMENDED.map((r) => (
        <Pressable key={r.id} style={s.rowCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>{r.name}</Text>
            <Text style={s.rowMeta}>{r.tags}</Text>
            <Text style={s.rowReason}>{r.reason}</Text>
          </View>
          <Text style={s.chev}>→</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/* ============================================================
   DISCOVER
   ============================================================ */

function DiscoverScreen({ s, t }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const filters = ['All', 'Today', 'This Week', 'Free', 'Near Me'];

  const results = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    return {
      events: TODAY_EVENTS.filter(
        (e) => e.title.toLowerCase().includes(q) || e.cat.toLowerCase().includes(q)
      ),
      orgs: RECOMMENDED.filter((r) => r.name.toLowerCase().includes(q)),
      places: NEARBY.filter((p) => p.name.toLowerCase().includes(q)),
    };
  }, [query]);

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.screenContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={s.pageTitle}>Discover</Text>
      <Text style={s.pageSub}>Find something worth doing.</Text>

      <SearchField
        s={s}
        t={t}
        placeholder="Search RaiderLoop"
        value={query}
        onChangeText={setQuery}
      />

      {results ? (
        <View style={{ marginTop: 8 }}>
          <SectionHeader s={s} t={t} label="TOP RESULTS" />
          {results.events.length ? (
            <>
              <Text style={s.resultGroup}>EVENTS</Text>
              {results.events.map((e) => (
                <Pressable key={e.id} style={s.rowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle}>{e.title}</Text>
                    <Text style={s.rowMeta}>{e.time} · {e.place}</Text>
                  </View>
                  <Text style={s.chev}>→</Text>
                </Pressable>
              ))}
            </>
          ) : null}
          {results.orgs.length ? (
            <>
              <Text style={s.resultGroup}>ORGANIZATIONS</Text>
              {results.orgs.map((r) => (
                <Pressable key={r.id} style={s.rowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle}>{r.name}</Text>
                    <Text style={s.rowMeta}>{r.tags}</Text>
                  </View>
                  <Text style={s.chev}>→</Text>
                </Pressable>
              ))}
            </>
          ) : null}
          {results.places.length ? (
            <>
              <Text style={s.resultGroup}>PLACES</Text>
              {results.places.map((p) => (
                <Pressable key={p.id} style={s.rowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle}>{p.name}</Text>
                    <Text style={s.rowMeta}>{p.kind} · {p.dist}</Text>
                  </View>
                  <Text style={s.chev}>→</Text>
                </Pressable>
              ))}
            </>
          ) : null}
          {!results.events.length && !results.orgs.length && !results.places.length ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyTitle}>Nothing matched "{query}"</Text>
              <Text style={s.emptyBody}>Try a broader search, or ask Red to find it for you.</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <>
          <Text style={s.sectionLabelLoose}>What are you looking for?</Text>
          {DISCOVER_CATEGORIES.map((c) => (
            <Pressable key={c.id} style={s.categoryCard}>
              <Flow intensity={1} origin="bottomRight" color={t.red} size={150} />
              <View style={{ flex: 1 }}>
                <Text style={s.categoryTitle}>{c.title}</Text>
                <Text style={s.rowMeta}>{c.sub}</Text>
              </View>
              <Text style={s.chev}>→</Text>
            </Pressable>
          ))}

          <SectionHeader s={s} t={t} label="YOU MIGHT LIKE" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 20, paddingTop: 4 }}
            style={{ marginHorizontal: -20, paddingHorizontal: 20 }}
          >
            {filters.map((f) => (
              <Pill key={f} s={s} t={t} label={f} active={filter === f} onPress={() => setFilter(f)} />
            ))}
          </ScrollView>

          <View style={{ marginTop: 14 }}>
            {TODAY_EVENTS.map((e) => (
              <Pressable key={e.id} style={s.rowCard}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{e.title}</Text>
                  <Text style={s.rowMeta}>{e.time} · {e.place}</Text>
                  <Text style={s.rowReason}>Because you like {e.cat}</Text>
                </View>
                <Text style={s.chev}>→</Text>
              </Pressable>
            ))}
          </View>

          <SectionHeader s={s} t={t} label="POPULAR AROUND CAMPUS" />
          {RECOMMENDED.map((r) => (
            <Pressable key={r.id} style={s.rowCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{r.name}</Text>
                <Text style={s.rowMeta}>{r.tags}</Text>
              </View>
              <Text style={s.chev}>→</Text>
            </Pressable>
          ))}
        </>
      )}
    </ScrollView>
  );
}

/* ============================================================
   CAMPUS
   ============================================================ */

function CampusScreen({ s, t }) {
  const [query, setQuery] = useState('');
  const quick = ['Buildings', 'Dining', 'Libraries', 'Parking', 'Services', 'Recreation'];

  const list = query.trim()
    ? BUILDINGS.filter((b) => b.name.toLowerCase().includes(query.toLowerCase()))
    : BUILDINGS;

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.screenContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={s.pageTitle}>Campus</Text>
      <Text style={s.pageSub}>Where do you need to go?</Text>

      <SearchField
        s={s}
        t={t}
        placeholder="Search buildings, rooms…"
        value={query}
        onChangeText={setQuery}
      />

      <SectionHeader s={s} t={t} label="YOUR NEXT CLASS" />
      <View style={s.nextClassCard}>
        <Flow intensity={2} origin="bottomLeft" color={t.red} size={190} />
        <Text style={s.nextClassCode}>CS 1412</Text>
        <Text style={s.rowMeta}>Engineering Center · Room 101</Text>
        <Text style={s.countdown}>Starts in 42 minutes</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Pressable style={s.primaryBtn}>
            <Text style={s.primaryBtnText}>Directions</Text>
          </Pressable>
          <Pressable style={s.ghostBtn}>
            <Text style={s.ghostBtnText}>View room</Text>
          </Pressable>
        </View>
      </View>

      <SectionHeader s={s} t={t} label="QUICK ACCESS" />
      <View style={s.quickGrid}>
        {quick.map((q) => (
          <Pressable key={q} style={s.quickTile}>
            <Text style={s.quickText}>{q}</Text>
          </Pressable>
        ))}
      </View>

      <SectionHeader s={s} t={t} label="CAMPUS MAP" />
      <View style={s.mapBox}>
        <Flow intensity={1} origin="center" color={t.red} size={160} />
        <Text style={s.mapPlaceholder}>Map goes here</Text>
        <Text style={s.mapNote}>
          Hook up react-native-maps or Mapbox with a custom warm-ivory style.
        </Text>
      </View>

      <SectionHeader s={s} t={t} label={query.trim() ? 'RESULTS' : 'BUILDINGS'} />
      {list.length ? (
        list.map((b) => (
          <Pressable key={b.id} style={s.rowCard}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>{b.name}</Text>
              <Text style={s.rowMeta}>{b.kind} · {b.dist}</Text>
            </View>
            <Text style={s.chev}>→</Text>
          </Pressable>
        ))
      ) : (
        <View style={s.emptyBox}>
          <Text style={s.emptyTitle}>Can't find that location</Text>
          <Text style={s.emptyBody}>Try searching for a building, room, or campus service.</Text>
        </View>
      )}
    </ScrollView>
  );
}

/* ============================================================
   SCHEDULE
   ============================================================ */

function ScheduleScreen({ s, t }) {
  const [view, setView] = useState('Today');
  const days = [
    { d: 'MON', n: '24' }, { d: 'TUE', n: '25' }, { d: 'WED', n: '26' },
    { d: 'THU', n: '27' }, { d: 'FRI', n: '28' }, { d: 'SAT', n: '29' },
  ];
  const [activeDay, setActiveDay] = useState('29');

  const typeColor = (type) =>
    type === 'class' ? t.red : type === 'event' ? t.redSoft : t.textMuted;

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.screenContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={s.pageTitle}>Schedule</Text>
      <Text style={s.pageSub}>Saturday, August 29</Text>

      <View style={s.segment}>
        {['Today', 'Week', 'Month'].map((v) => (
          <Pressable
            key={v}
            onPress={() => setView(v)}
            style={[s.segmentItem, view === v && { backgroundColor: t.red }]}
          >
            <Text style={[s.segmentText, view === v && { color: t.onRed }]}>{v}</Text>
          </Pressable>
        ))}
      </View>

      {view === 'Week' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 20 }}
          style={{ marginHorizontal: -20, paddingHorizontal: 20, marginBottom: 6 }}
        >
          {days.map((d) => (
            <Pressable
              key={d.n}
              onPress={() => setActiveDay(d.n)}
              style={[s.dayChip, activeDay === d.n && { backgroundColor: t.red, borderColor: t.red }]}
            >
              <Text style={[s.dayChipDay, activeDay === d.n && { color: t.onRed }]}>{d.d}</Text>
              <Text style={[s.dayChipNum, activeDay === d.n && { color: t.onRed }]}>{d.n}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <SectionHeader s={s} t={t} label="NEXT UP" />
      <View style={s.nextUpCard}>
        <Flow intensity={2} origin="topRight" color={t.red} size={180} />
        <Text style={s.nextClassCode}>CS 1412</Text>
        <Text style={s.rowMeta}>1:00 PM · Engineering Center 101</Text>
        <Text style={s.countdown}>Starts in 42 minutes</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          <Pressable style={s.primaryBtn}>
            <Text style={s.primaryBtnText}>Navigate</Text>
          </Pressable>
          <Pressable style={s.ghostBtn}>
            <Text style={s.ghostBtnText}>Details</Text>
          </Pressable>
        </View>
      </View>

      <SectionHeader s={s} t={t} label="TODAY" action="+ Add" />
      {SCHEDULE_TODAY.map((item) => (
        <View key={item.id} style={s.timelineRow}>
          <View style={s.timelineLeft}>
            <Text style={s.timelineTime}>{item.time}</Text>
          </View>
          <View style={[s.timelineBar, { backgroundColor: typeColor(item.type) }]} />
          <Pressable style={s.timelineCard}>
            <Text style={s.rowTitle}>{item.title}</Text>
            <Text style={s.rowMeta}>{item.place}</Text>
            <Text style={s.rowReason}>
              {item.type === 'class' ? 'Class' : item.type === 'event' ? 'Event' : 'Personal'} · Take me there →
            </Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

/* ============================================================
   YOU
   ============================================================ */

function YouScreen({ s, t, dark, setDark }) {
  const [selected, setSelected] = useState(['Sports', 'Technology', 'Gaming', 'Faith']);

  const toggle = (i) =>
    setSelected((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.screenContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={s.pageTitle}>You</Text>

      <View style={s.identityCard}>
        <Flow intensity={2} origin="topRight" color={t.red} size={190} />
        <Text style={s.identityName}>Joshua Taylor</Text>
        <Text style={s.rowMeta}>Texas Tech University</Text>
        <Text style={s.rowMeta}>Computer Science · Class of 2030</Text>
        <Pressable style={[s.ghostBtn, { marginTop: 14, alignSelf: 'flex-start' }]}>
          <Text style={s.ghostBtnText}>Edit profile</Text>
        </Pressable>
      </View>

      <View style={s.statsRow}>
        {[
          { n: '12', l: 'Saved' },
          { n: '6', l: 'Upcoming' },
          { n: '4', l: 'Places' },
        ].map((x) => (
          <Pressable key={x.l} style={s.statBox}>
            <Text style={s.statNum}>{x.n}</Text>
            <Text style={s.statLabel}>{x.l}</Text>
          </Pressable>
        ))}
      </View>

      <SectionHeader s={s} t={t} label="YOUR INTERESTS" />
      <Text style={s.sectionSub}>These shape what shows up in Discover.</Text>
      <View style={s.interestWrap}>
        {INTERESTS.map((i) => (
          <Pill
            key={i}
            s={s}
            t={t}
            label={i}
            active={selected.includes(i)}
            onPress={() => toggle(i)}
          />
        ))}
      </View>

      <SectionHeader s={s} t={t} label="APPEARANCE" />
      <Pressable style={s.rowCard} onPress={() => setDark(!dark)}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowTitle}>Dark mode</Text>
          <Text style={s.rowMeta}>{dark ? 'On' : 'Off'}</Text>
        </View>
        <View style={[s.toggle, dark && { backgroundColor: t.red }]}>
          <View style={[s.toggleKnob, dark && { alignSelf: 'flex-end' }]} />
        </View>
      </Pressable>

      <SectionHeader s={s} t={t} label="SETTINGS" />
      {[
        { title: 'Connected services', meta: 'Calendar, campus accounts' },
        { title: 'Notifications', meta: 'Schedule, campus, discover' },
        { title: 'Privacy & data', meta: 'What RaiderLoop uses and why' },
        { title: 'Help & feedback', meta: 'Report a problem' },
      ].map((x) => (
        <Pressable key={x.title} style={s.rowCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>{x.title}</Text>
            <Text style={s.rowMeta}>{x.meta}</Text>
          </View>
          <Text style={s.chev}>→</Text>
        </Pressable>
      ))}

      <Text style={s.versionText}>RaiderLoop · Version 0.1.0</Text>
    </ScrollView>
  );
}

/* ============================================================
   ASK RED
   ============================================================ */

function AskRed({ s, t, visible, onClose }) {
  const [input, setInput] = useState('');
  const [thread, setThread] = useState([]);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });

  const ask = (text) => {
    const q = (text || input).trim();
    if (!q) return;
    const lower = q.toLowerCase();
    const hit =
      RED_REPLIES.find((r) => r.match.some((m) => lower.includes(m))) || {
        text: "I don't have verified information for that yet.",
        results: [],
      };
    setThread((prev) => [...prev, { role: 'user', text: q }, { role: 'red', ...hit }]);
    setInput('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.sheetBackdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={s.sheet}>
          <Flow intensity={3} origin="topRight" color={t.red} size={240} />
          <View style={s.sheetHandle} />

          <View style={{ alignItems: 'center', marginBottom: 18 }}>
            <Animated.View style={[s.redOrb, { transform: [{ scale }] }]}>
              <Text style={s.redOrbText}>R</Text>
            </Animated.View>
            <Text style={s.sheetTitle}>Ask Red</Text>
            <Text style={s.sheetSub}>Your assistant for anything campus.</Text>
          </View>

          <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
            {thread.length === 0 ? (
              <>
                <Text style={s.resultGroup}>TRY ASKING</Text>
                {RED_SUGGESTIONS.map((q) => (
                  <Pressable key={q} style={s.suggestion} onPress={() => ask(q)}>
                    <Text style={s.suggestionText}>{q}</Text>
                  </Pressable>
                ))}
              </>
            ) : (
              thread.map((m, i) =>
                m.role === 'user' ? (
                  <View key={i} style={s.userBubble}>
                    <Text style={s.userBubbleText}>{m.text}</Text>
                  </View>
                ) : (
                  <View key={i} style={{ marginBottom: 16 }}>
                    <Text style={s.redText}>{m.text}</Text>
                    {m.results?.map((r, j) => (
                      <Pressable key={j} style={s.redResult}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.rowTitle}>{r.title}</Text>
                          <Text style={s.rowMeta}>{r.meta}</Text>
                        </View>
                        <Text style={s.chev}>→</Text>
                      </Pressable>
                    ))}
                  </View>
                )
              )
            )}
          </ScrollView>

          <View style={s.askRow}>
            <TextInput
              style={s.askInput}
              placeholder="Ask anything about campus…"
              placeholderTextColor={t.textMuted}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => ask()}
              returnKeyType="send"
            />
            <Pressable style={s.askSend} onPress={() => ask()}>
              <Text style={s.askSendText}>➤</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ============================================================
   ROOT
   ============================================================ */

const TABS = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'discover', label: 'Discover', icon: '⌕' },
  { id: 'campus', label: 'Campus', icon: '⚑' },
  { id: 'schedule', label: 'Schedule', icon: '▤' },
  { id: 'you', label: 'You', icon: '☺' },
];

export default function App() {
  const [tab, setTab] = useState('home');
  const [dark, setDark] = useState(false);
  const [redOpen, setRedOpen] = useState(false);

  const t = dark ? darkTheme : lightTheme;
  const s = useMemo(() => makeStyles(t), [t]);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: t.canvas }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />

      <View style={{ flex: 1 }}>
        {tab === 'home' && <HomeScreen s={s} t={t} goTo={setTab} />}
        {tab === 'discover' && <DiscoverScreen s={s} t={t} />}
        {tab === 'campus' && <CampusScreen s={s} t={t} />}
        {tab === 'schedule' && <ScheduleScreen s={s} t={t} />}
        {tab === 'you' && <YouScreen s={s} t={t} dark={dark} setDark={setDark} />}
      </View>

      <Pressable style={s.askFab} onPress={() => setRedOpen(true)}>
        <View style={s.askFabDot} />
        <Text style={s.askFabText}>Ask Red</Text>
      </Pressable>

      <View style={s.nav}>
        {TABS.map((x) => {
          const active = tab === x.id;
          return (
            <Pressable key={x.id} style={s.navItem} onPress={() => setTab(x.id)}>
              <Text style={[s.navIcon, active && { color: t.red }]}>{x.icon}</Text>
              <Text style={[s.navLabel, active && { color: t.red, fontWeight: '600' }]}>
                {x.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <AskRed s={s} t={t} visible={redOpen} onClose={() => setRedOpen(false)} />
    </SafeAreaView>
  );
}

/* ============================================================
   STYLES
   ============================================================ */

function makeStyles(t) {
  const card = {
    backgroundColor: t.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: t.border,
    padding: 16,
    marginBottom: 10,
    overflow: 'hidden',
  };

  return StyleSheet.create({
    root: {
      flex: 1,
      paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    screen: { flex: 1 },
    screenContent: { padding: 20, paddingBottom: 160 },

    /* brand */
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
    brandText: { fontSize: 15, fontWeight: '800', letterSpacing: 1.2, color: t.text },

    /* headings */
    greeting: { fontSize: 27, fontWeight: '700', color: t.text, letterSpacing: -0.5 },
    greetingSub: { fontSize: 15, color: t.textMuted, marginTop: 4, marginBottom: 18 },
    pageTitle: { fontSize: 30, fontWeight: '700', color: t.text, letterSpacing: -0.6 },
    pageSub: { fontSize: 15, color: t.textMuted, marginTop: 4, marginBottom: 18 },

    sectionHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 26,
      marginBottom: 10,
    },
    sectionLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1.4, color: t.textMuted },
    sectionLabelLoose: {
      fontSize: 17, fontWeight: '600', color: t.text, marginTop: 26, marginBottom: 12,
    },
    sectionSub: { fontSize: 13.5, color: t.textMuted, marginTop: -4, marginBottom: 12 },
    sectionAction: { fontSize: 13, color: t.red, fontWeight: '600' },
    resultGroup: {
      fontSize: 11, fontWeight: '700', letterSpacing: 1.2,
      color: t.textMuted, marginTop: 14, marginBottom: 8,
    },

    /* search */
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.surfaceAlt,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 14,
      height: 48,
    },
    searchIcon: { fontSize: 18, color: t.textMuted, marginRight: 8 },
    searchInput: { flex: 1, fontSize: 15, color: t.text, padding: 0 },

    /* hero loop card */
    heroCard: {
      ...card,
      width: SCREEN_W * 0.78,
      marginRight: 12,
      padding: 20,
      minHeight: 200,
      justifyContent: 'space-between',
    },
    heroEyebrow: {
      fontSize: 10.5, fontWeight: '700', letterSpacing: 1.3, color: t.red, marginBottom: 10,
    },
    heroTitle: { fontSize: 21, fontWeight: '700', color: t.text, letterSpacing: -0.3 },
    heroMeta: { fontSize: 14, color: t.textMuted, marginTop: 3 },
    heroReason: { fontSize: 12.5, color: t.textMuted, marginTop: 12, fontStyle: 'italic' },
    heroBtn: {
      backgroundColor: t.red,
      borderRadius: 12,
      paddingVertical: 11,
      alignItems: 'center',
      marginTop: 16,
    },
    heroBtnText: { color: t.onRed, fontWeight: '600', fontSize: 14 },

    /* event card */
    eventCard: {
      ...card,
      width: 150,
      marginRight: 10,
      minHeight: 130,
    },
    eventDate: {
      fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2, color: t.red, marginBottom: 10,
    },
    eventTitle: { fontSize: 16, fontWeight: '600', color: t.text },
    eventMeta: { fontSize: 12.5, color: t.textMuted, marginTop: 2 },

    /* generic row card */
    rowCard: { ...card, flexDirection: 'row', alignItems: 'center' },
    rowTitle: { fontSize: 15.5, fontWeight: '600', color: t.text },
    rowMeta: { fontSize: 13, color: t.textMuted, marginTop: 2 },
    rowReason: { fontSize: 12, color: t.red, marginTop: 5 },
    rowStatus: { fontSize: 12.5, fontWeight: '600', color: '#2E9E5B' },
    chev: { fontSize: 17, color: t.textMuted, marginLeft: 10 },

    /* official */
    officialCard: { ...card, padding: 20 },
    officialBadge: {
      alignSelf: 'flex-start',
      backgroundColor: t.red,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 6,
      marginBottom: 12,
    },
    officialBadgeText: {
      color: t.onRed, fontSize: 9.5, fontWeight: '800', letterSpacing: 1.1,
    },
    officialTitle: { fontSize: 20, fontWeight: '700', color: t.text },
    officialBody: { fontSize: 14, color: t.textMuted, marginTop: 12, lineHeight: 20 },

    /* buttons */
    primaryBtn: {
      backgroundColor: t.red,
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: 20,
      alignItems: 'center',
      marginTop: 14,
      alignSelf: 'flex-start',
    },
    primaryBtnText: { color: t.onRed, fontWeight: '600', fontSize: 14 },
    ghostBtn: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceAlt,
      paddingVertical: 11,
      paddingHorizontal: 20,
      marginTop: 14,
    },
    ghostBtnText: { color: t.text, fontWeight: '600', fontSize: 14 },

    /* pills */
    pill: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surfaceAlt,
      paddingHorizontal: 15,
      paddingVertical: 8,
      marginRight: 8,
      marginBottom: 8,
    },
    pillText: { fontSize: 13.5, color: t.text, fontWeight: '500' },

    /* discover */
    categoryCard: { ...card, flexDirection: 'row', alignItems: 'center', padding: 20, minHeight: 88 },
    categoryTitle: { fontSize: 18, fontWeight: '700', color: t.text, marginBottom: 3 },

    /* campus */
    nextClassCard: { ...card, padding: 20 },
    nextClassCode: { fontSize: 22, fontWeight: '700', color: t.text, marginBottom: 4 },
    countdown: { fontSize: 13.5, color: t.red, fontWeight: '600', marginTop: 10 },
    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    quickTile: {
      width: (SCREEN_W - 50) / 2,
      backgroundColor: t.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      paddingVertical: 18,
      alignItems: 'center',
    },
    quickText: { fontSize: 14.5, fontWeight: '600', color: t.text },
    mapBox: {
      height: 200,
      backgroundColor: t.surfaceAlt,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    mapPlaceholder: { fontSize: 15, fontWeight: '600', color: t.text },
    mapNote: {
      fontSize: 12, color: t.textMuted, marginTop: 6,
      textAlign: 'center', paddingHorizontal: 30,
    },

    /* schedule */
    segment: {
      flexDirection: 'row',
      backgroundColor: t.surfaceAlt,
      borderRadius: 14,
      padding: 4,
      borderWidth: 1,
      borderColor: t.border,
      marginBottom: 4,
    },
    segmentItem: { flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center' },
    segmentText: { fontSize: 14, fontWeight: '600', color: t.textMuted },
    dayChip: {
      width: 56,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
      alignItems: 'center',
      marginRight: 8,
    },
    dayChipDay: { fontSize: 10.5, fontWeight: '700', color: t.textMuted, letterSpacing: 0.8 },
    dayChipNum: { fontSize: 17, fontWeight: '700', color: t.text, marginTop: 2 },
    nextUpCard: { ...card, padding: 20 },
    timelineRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: 10 },
    timelineLeft: { width: 72, paddingTop: 16 },
    timelineTime: { fontSize: 12.5, fontWeight: '600', color: t.textMuted },
    timelineBar: { width: 3, borderRadius: 2, marginRight: 12, opacity: 0.85 },
    timelineCard: {
      flex: 1,
      backgroundColor: t.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      padding: 14,
    },

    /* you */
    identityCard: { ...card, padding: 20, marginTop: 8 },
    identityName: { fontSize: 22, fontWeight: '700', color: t.text, marginBottom: 4 },
    statsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    statBox: {
      flex: 1,
      backgroundColor: t.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      paddingVertical: 16,
      alignItems: 'center',
    },
    statNum: { fontSize: 22, fontWeight: '700', color: t.text },
    statLabel: { fontSize: 12, color: t.textMuted, marginTop: 2 },
    interestWrap: { flexDirection: 'row', flexWrap: 'wrap' },
    toggle: {
      width: 48,
      height: 28,
      borderRadius: 999,
      backgroundColor: t.surfaceAlt,
      borderWidth: 1,
      borderColor: t.border,
      padding: 3,
      justifyContent: 'center',
    },
    toggleKnob: {
      width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF',
    },
    versionText: {
      fontSize: 12, color: t.textMuted, textAlign: 'center', marginTop: 30,
    },

    /* empty states */
    emptyBox: {
      backgroundColor: t.surfaceAlt,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: t.border,
      padding: 22,
      alignItems: 'center',
    },
    emptyTitle: { fontSize: 15.5, fontWeight: '600', color: t.text },
    emptyBody: {
      fontSize: 13.5, color: t.textMuted, marginTop: 5, textAlign: 'center',
    },

    /* ask red fab */
    askFab: {
      position: 'absolute',
      bottom: 92,
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: t.red,
      paddingHorizontal: 20,
      paddingVertical: 13,
      borderRadius: 999,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    askFabDot: {
      width: 8, height: 8, borderRadius: 4, backgroundColor: t.onRed,
    },
    askFabText: { color: t.onRed, fontWeight: '700', fontSize: 14.5 },

    /* nav */
    nav: {
      flexDirection: 'row',
      backgroundColor: t.navBg,
      borderTopWidth: 1,
      borderTopColor: t.border,
      paddingTop: 10,
      paddingBottom: Platform.OS === 'ios' ? 22 : 12,
    },
    navItem: { flex: 1, alignItems: 'center' },
    navIcon: { fontSize: 19, color: t.textMuted },
    navLabel: { fontSize: 10.5, color: t.textMuted, marginTop: 3 },

    /* ask red sheet */
    sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
    sheet: {
      backgroundColor: t.canvas,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 20,
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
      overflow: 'hidden',
    },
    sheetHandle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: t.border, alignSelf: 'center', marginBottom: 18,
    },
    redOrb: {
      width: 58, height: 58, borderRadius: 29,
      backgroundColor: t.red, alignItems: 'center', justifyContent: 'center',
      marginBottom: 12,
    },
    redOrbText: { color: t.onRed, fontSize: 26, fontWeight: '800' },
    sheetTitle: { fontSize: 22, fontWeight: '700', color: t.text },
    sheetSub: { fontSize: 13.5, color: t.textMuted, marginTop: 3 },
    suggestion: {
      backgroundColor: t.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      padding: 14,
      marginBottom: 8,
    },
    suggestionText: { fontSize: 14.5, color: t.text },
    userBubble: {
      alignSelf: 'flex-end',
      backgroundColor: t.red,
      borderRadius: 16,
      paddingHorizontal: 15,
      paddingVertical: 10,
      marginBottom: 12,
      maxWidth: '85%',
    },
    userBubbleText: { color: t.onRed, fontSize: 14.5 },
    redText: { fontSize: 15, color: t.text, marginBottom: 10, lineHeight: 21 },
    redResult: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.border,
      padding: 14,
      marginBottom: 8,
    },
    askRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
    askInput: {
      flex: 1,
      backgroundColor: t.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.border,
      paddingHorizontal: 16,
      height: 50,
      fontSize: 15,
      color: t.text,
    },
    askSend: {
      width: 50, height: 50, borderRadius: 25,
      backgroundColor: t.red, alignItems: 'center', justifyContent: 'center',
    },
    askSendText: { color: t.onRed, fontSize: 18 },
  });
}
