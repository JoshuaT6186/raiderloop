/**
 * Discover — a corkboard of post-its. Each kind of content gets a
 * shape that fits it: events are tall notes, clubs are index cards,
 * dining is a running list with live open/closed stamps.
 */
import React, { useMemo, useState } from 'react';
import { View, ScrollView, Image } from 'react-native';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme/ThemeContext';
import { SCREEN_W, PAD, tiltFor, postitFor } from '../theme/tokens';
import { Page } from '../ui/Page';
import {
  T, PostIt, PT, Card, Section, Button, Row, Chip, Field, Stamp, Loading, Empty, Disclosure, Sheet,
} from '../ui/Paper';
import Icon from '../ui/Icon';
import { useCallable } from '../lib/hooks';
import { api } from '../lib/firebase';
import { metaLine } from '../lib/time';
import { isOpenNow, todayHoursText } from '../lib/hours';
import { openUrl } from '../lib/links';
import { BannerAd, affiliateSearchUrl, isAffiliate } from '../lib/monetize';
import {
  ORGS, DINING, BUILDINGS, STUDY, RESOURCES, QUICK_LINKS, GREEK_ORGS, ORG_CATEGORIES, orgsForInterests,
  nextGame, lastGame, gameDateLabel, SPORTS_LIST, catLabel, walkLabel, FOOTBALL_SCHEDULE,
} from '../data/campus';

const CARD_W = SCREEN_W * 0.62;

/* ---------- Search ---------- */
function SearchResults({ q }) {
  const { setSheet } = useApp();
  const { t } = useTheme();
  const s = q.trim().toLowerCase();
  const orgs = ORGS.filter((o) => o.name.toLowerCase().includes(s)).slice(0, 6);
  const places = BUILDINGS.filter((b) => b.name.toLowerCase().includes(s)).slice(0, 5);
  const food = DINING.filter((d) => `${d.name} ${d.venue}`.toLowerCase().includes(s)).slice(0, 4);
  if (!orgs.length && !places.length && !food.length) return <Empty icon="search" title={`Nothing matches "${q}"`} body="Try a building, a club, or somewhere to eat." />;
  return (
    <Card>
      {food.map((d) => <Row key={d.id} title={d.name} meta={metaLine('Dining', d.venue)} left={<Icon name="food" color={t.ink} />} onPress={() => setSheet({ type: 'dining', id: d.id })} />)}
      {places.map((b) => <Row key={b.id} title={b.name} meta={metaLine(catLabel(b.kind), walkLabel(b))} left={<Icon name="building" color={t.ink} />} onPress={() => setSheet({ type: 'building', id: b.id })} />)}
      {orgs.map((o, i) => <Row key={o.id} title={o.name} meta={o.tags} left={<Icon name="users" color={t.ink} />} onPress={() => setSheet({ type: 'org', id: o.id })} last={i === orgs.length - 1} />)}
    </Card>
  );
}

/* ---------- Featured game ---------- */
function FeaturedGame() {
  const { setSheet } = useApp();
  const g = nextGame(); const last = lastGame();
  const img = useCallable(api.getVenueImage, { query: 'Galaxy Stadium Lubbock Texas Tech football stadium' }, 'image', { asArray: false });
  if (!g) return null;
  const home = g.homeAway === 'home';
  return (
    <PostIt color="orange" tilt={-1.2} tape padding={0} onPress={() => setSheet({ type: 'gameday', kickoff: g.kickoff })} style={{ marginTop: 14, overflow: 'hidden' }}>
      {img.data ? <Image source={{ uri: img.data }} style={{ width: '100%', height: 150, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} resizeMode="cover" /> : null}
      <View style={{ padding: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <PT kind="tiny" style={{ flex: 1 }}>Next game · {home ? 'Home' : 'Away'}</PT>
          {last ? <PT kind="small">Last: {last.result} vs {last.opponent}</PT> : null}
        </View>
        <PT kind="title" style={{ fontSize: 22, lineHeight: 27, marginTop: 4 }}>{home ? 'vs.' : 'at'} {g.opponent}</PT>
        <PT kind="small">{metaLine(gameDateLabel(g.kickoff), g.venue)}</PT>
      </View>
    </PostIt>
  );
}

/* ---------- Live events ---------- */
function Happening() {
  const { setSheet, isSaved } = useApp();
  const ev = useCallable(api.getEvents, {}, 'events');
  const events = (ev.data || []).map((e, i) => ({ ...e, id: e.id || `live-${i}-${(e.title || '').slice(0, 20)}`, location: e.location }));
  return (
    <>
      <Section title="Happening" icon="ticket" hand="Real upcoming events, refreshed every few hours" />
      {ev.loading ? <Loading label="Pinning up this week's events…" /> : null}
      {!ev.loading && !events.length ? <Card><T kind="hand">quiet week on the board</T><T kind="small">No dated upcoming events were found. Ask Pilot what's on tonight.</T></Card> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -PAD, marginLeft: -(PAD + 22) }} contentContainerStyle={{ paddingLeft: PAD + 22, paddingRight: PAD, paddingVertical: 8 }}>
        {events.map((e) => (
          <View key={e.id} style={{ width: CARD_W, marginRight: 14 }}>
            <PostIt color={postitFor(e.id)} seed={e.id} onPress={() => setSheet({ type: 'event', ev: e })} minHeight={170} padding={0}>
              {e.img ? <Image source={{ uri: e.img }} style={{ width: '100%', height: 90, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} resizeMode="cover" /> : null}
              <View style={{ padding: 12 }}>
                <PT kind="tiny">{metaLine(e.date, e.time)}</PT>
                <PT kind="bold" numberOfLines={2} style={{ marginTop: 2 }}>{e.title}</PT>
                <PT kind="small" numberOfLines={1}>{e.location || e.org}</PT>
                {isSaved(e.id) ? <View style={{ position: 'absolute', top: 10, right: 10 }}><Icon name="bookmark" size={16} color="#1F2A44" fill="#1F2A44" /></View> : null}
              </View>
            </PostIt>
          </View>
        ))}
      </ScrollView>
    </>
  );
}

/* ---------- Local sponsors (paid, always labeled) ---------- */
function Sponsors() {
  const { isPlus } = useApp();
  const sp = useCallable(api.getSponsors, {}, 'sponsors');
  const list = (sp.data || []).slice(0, isPlus ? 0 : 2);
  if (!list.length) return null;
  return (
    <View style={{ marginTop: 18 }}>
      {list.map((s) => (
        <PostIt key={s.id} color={s.color || 'green'} seed={s.id} onPress={() => openUrl(s.url)} style={{ marginBottom: 12 }}>
          <Disclosure label="Sponsored · local" />
          <PT kind="title" style={{ marginTop: 6 }}>{s.name}</PT>
          <PT kind="body">{s.offer}</PT>
          {s.distance ? <PT kind="small" style={{ marginTop: 2 }}>{s.distance}</PT> : null}
        </PostIt>
      ))}
    </View>
  );
}

/* ---------- Orgs ---------- */
export function OrgBrowser({ initial, onClose }) {
  const { setSheet, followedOrgIds } = useApp();
  const { t } = useTheme();
  const [cat, setCat] = useState(initial || 'All');
  const [q, setQ] = useState('');
  const cats = ['All', 'Following', 'Greek Life', ...ORG_CATEGORIES];
  const list = useMemo(() => {
    let l = ORGS;
    if (cat === 'Greek Life') l = GREEK_ORGS;
    else if (cat === 'Following') l = ORGS.filter((o) => followedOrgIds.includes(o.id));
    else if (cat !== 'All') l = ORGS.filter((o) => o.tags === cat);
    const s = q.trim().toLowerCase();
    return s ? l.filter((o) => o.name.toLowerCase().includes(s) || (o.reason || '').toLowerCase().includes(s)) : l;
  }, [cat, q, followedOrgIds]);
  return (
    <Sheet title="Clubs & orgs" hand={`${ORGS.length} real student organizations`} onClose={onClose} height={0.92}>
      <Field placeholder="Search clubs…" value={q} onChangeText={setQ} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
        {cats.map((c) => <Chip key={c} label={c} active={cat === c} onPress={() => setCat(c)} />)}
      </ScrollView>
      <T kind="small" style={{ marginBottom: 4 }}>{list.length} {list.length === 1 ? 'org' : 'orgs'}</T>
      {list.slice(0, 120).map((o, i) => (
        <Row key={o.id} title={o.name} meta={o.reason} left={<View style={{ width: 38, height: 38, borderRadius: 6, backgroundColor: t.postit[postitFor(o.id)], alignItems: 'center', justifyContent: 'center', transform: [{ rotate: `${tiltFor(o.id, 4)}deg` }] }}><T kind="bold" color="#1F2A44">{o.initials}</T></View>}
          right={followedOrgIds.includes(o.id) ? <Icon name="check" color={t.ok} size={18} /> : null}
          onPress={() => setSheet({ type: 'org', id: o.id })} last={i === Math.min(list.length, 120) - 1} />
      ))}
      {list.length > 120 ? <T kind="small" style={{ marginTop: 8 }}>Showing 120 — search to narrow it down.</T> : null}
      {!list.length ? <Empty icon="users" title={cat === 'Following' ? "You're not following any clubs yet" : 'No orgs match that'} /> : null}
    </Sheet>
  );
}

function OrgCards({ orgs }) {
  const { setSheet } = useApp();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginLeft: -(PAD + 22), marginRight: -PAD }} contentContainerStyle={{ paddingLeft: PAD + 22, paddingRight: PAD, paddingVertical: 8 }}>
      {orgs.map((o) => (
        <View key={o.id} style={{ width: CARD_W * 0.82, marginRight: 12 }}>
          <Card onPress={() => setSheet({ type: 'org', id: o.id })} style={{ minHeight: 132 }}>
            <T kind="bold" numberOfLines={2}>{o.name}</T>
            <T kind="small" numberOfLines={3} style={{ marginTop: 4 }}>{o.reason}</T>
          </Card>
        </View>
      ))}
    </ScrollView>
  );
}

function ForYou() {
  const { interests } = useApp();
  const picks = useMemo(() => orgsForInterests(interests, 8), [interests]);
  return <OrgCards orgs={picks} />;
}

/* ---------- Dining ---------- */
function DiningList() {
  const { t } = useTheme();
  const { setSheet } = useApp();
  const sorted = [...DINING].sort((a, b) => (isOpenNow(b.hours) === true) - (isOpenNow(a.hours) === true) || (a.walk ?? 99) - (b.walk ?? 99));
  const [all, setAll] = useState(false);
  const shown = all ? sorted : sorted.slice(0, 6);
  return (
    <Card ruled>
      {shown.map((d, i) => {
        const open = isOpenNow(d.hours);
        return (
          <Row key={d.id} title={d.name} meta={metaLine(d.venue, todayHoursText(d.hours))} last={i === shown.length - 1}
            right={open == null ? null : <Stamp label={open ? 'Open' : 'Closed'} color={open ? t.ok : t.pencil} />}
            onPress={() => setSheet({ type: 'dining', id: d.id })} />
        );
      })}
      {!all ? <Button title={`All ${DINING.length} spots`} kind="ghost" small onPress={() => setAll(true)} style={{ marginTop: 8 }} /> : null}
    </Card>
  );
}

/* ---------- Sports ---------- */
export function SportsSheet({ onClose }) {
  const { t } = useTheme();
  const [sport, setSport] = useState('Football');
  const live = useCallable(api.getSportsSchedule, { sport }, 'schedule', { enabled: sport !== 'Football' });
  const rows = sport === 'Football'
    ? FOOTBALL_SCHEDULE.map((g) => ({ opponent: g.opponent, date: gameDateLabel(g.kickoff), homeAway: g.homeAway, venue: g.venue, result: g.result }))
    : (live.data || []);
  return (
    <Sheet title="Red Raider sports" hand={sport === 'Football' ? 'Verified 2026 schedule' : 'Pulled live from schedule pages'} onClose={onClose}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        {SPORTS_LIST.map((s) => <Chip key={s} label={s} active={sport === s} onPress={() => setSport(s)} />)}
      </ScrollView>
      {live.loading && sport !== 'Football' ? <Loading label={`Finding the ${sport.toLowerCase()} schedule…`} /> : null}
      {rows.map((g, i) => (
        <Row key={`${g.opponent}-${i}`} title={`${g.homeAway === 'away' ? 'at' : 'vs.'} ${g.opponent}`} meta={metaLine(g.date, g.time, g.venue)} last={i === rows.length - 1}
          right={g.result ? <Stamp label={g.result} color={/^W/.test(g.result) ? t.ok : t.redPen} /> : null} />
      ))}
      {!live.loading && !rows.length ? <Empty icon="trophy" title="No published schedule found yet." /> : null}
    </Sheet>
  );
}

/* ---------- Screen ---------- */
export default function Discover() {
  const { t } = useTheme();
  const { setSheet, isPlus } = useApp();
  const [q, setQ] = useState('');
  return (
    <Page eyebrow="the corkboard" title="Discover">
      <Field placeholder="Search clubs, buildings, food…" value={q} onChangeText={setQ} style={{ marginTop: 12, marginBottom: 0 }} returnKeyType="search" clearButtonMode="while-editing" />
      {q.trim().length > 1 ? <View style={{ marginTop: 12 }}><SearchResults q={q} /></View> : (
        <>
          <FeaturedGame />
          <Happening />
          <Sponsors />

          <Section title="Picked for you" icon="sparkle" action="all clubs" onAction={() => setSheet({ type: 'orgs' })} hand="Clubs matching your interests" />
          <ForYou />

          <Section title="Greek life" icon="Greek Life" action="see all" onAction={() => setSheet({ type: 'orgs', initial: 'Greek Life' })} hand={`${GREEK_ORGS.length} chapters`} />
          <OrgCards orgs={GREEK_ORGS.slice(0, 10)} />

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
            {ORG_CATEGORIES.slice(0, 9).map((c) => <Chip key={c} label={c} onPress={() => setSheet({ type: 'orgs', initial: c })} />)}
          </View>

          <BannerAd isPlus={isPlus} />

          <Section title="Eat" icon="food" action="open now" onAction={() => setSheet({ type: 'openNow' })} />
          <DiningList />

          <Section title="Sports" icon="trophy" action="schedules" onAction={() => setSheet({ type: 'sports' })} />
          <Card onPress={() => setSheet({ type: 'sports' })}>
            <T kind="body">Football, basketball, baseball and more — full schedules in one place.</T>
          </Card>

          <Section title="Study spots" icon="book" />
          <Card>
            {STUDY.map((b, i) => (
              <Row key={b.id} title={b.name} meta={metaLine(walkLabel(b), b.hours ? todayHoursText(b.hours) : null)} last={i === STUDY.length - 1}
                right={isOpenNow(b.hours) === true ? <Stamp label="Open" color={t.ok} /> : null} onPress={() => setSheet({ type: 'building', id: b.id })} />
            ))}
          </Card>

          <Section title="Help & links" icon="help" />
          <Card>
            {RESOURCES.map((r) => <Row key={r.id} title={r.name} meta={r.kind} onPress={() => (r.url ? openUrl(r.url) : setSheet({ type: 'building', id: r.buildingId }))} />)}
            {QUICK_LINKS.map((l, i) => <Row key={l.id} title={l.name} meta={l.note} left={<Icon name="link" size={18} color={t.inkSoft} />} onPress={() => openUrl(l.url)} last={i === QUICK_LINKS.length - 1} />)}
          </Card>

          <Section title="Textbooks" icon="book" />
          <Card>
            <T kind="small">Check Raider Depot first for the exact edition your class requires, then compare prices.</T>
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <Button title="Raider Depot" small kind="ghost" onPress={() => openUrl('https://www.depts.ttu.edu/bookstore/')} style={{ marginRight: 8 }} />
              <Button title="Compare on Amazon" small kind="ghost" onPress={() => openUrl(affiliateSearchUrl('college textbook'))} />
            </View>
            {isAffiliate() ? <T kind="small" style={{ marginTop: 8, fontSize: 11 }}>Flyer may earn a small commission from Amazon links, at no cost to you.</T> : null}
          </Card>
        </>
      )}
    </Page>
  );
}
