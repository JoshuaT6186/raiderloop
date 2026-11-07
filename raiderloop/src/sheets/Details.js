/**
 * Detail sheets: events, orgs, buildings, dining halls.
 */
import React from 'react';
import { View, Image } from 'react-native';
import { Sheet, T, PostIt, PT, Button, Row, Card, Stamp, Loading } from '../ui/Paper';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api } from '../lib/firebase';
import { useCallable } from '../lib/hooks';
import { openUrl, openDirections } from '../lib/links';
import { shareThing } from '../lib/share';
import { addEventToCalendar } from '../lib/calendarExport';
import { hoursByDay, isOpenNow, minutesUntilClose } from '../lib/hours';
import { metaLine } from '../lib/time';
import {
  buildingById, catLabel, walkLabel, floorPlanFor, ORGS, DINING, BUS_STOPS, RESOURCES, isGreek,
} from '../data/campus';
import { StatusTaps } from './Status';
import { BuildingTips } from './Rooms';
import LastChecked from '../ui/LastChecked';
import { CHECKED } from '../config';

function HoursTable({ spec }) {
  const { t } = useTheme();
  return (
    <Card style={{ marginTop: 6 }} ruled>
      {hoursByDay(spec).map((r) => (
        <View key={r.day} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
          <T kind={r.isToday ? 'bold' : 'body'} color={r.isToday ? t.accent : t.ink}>{r.day}{r.isToday ? ' (today)' : ''}</T>
          <T kind={r.isToday ? 'bold' : 'body'} color={r.text === 'Closed' ? t.faint : r.isToday ? t.accent : t.ink}>{r.text}</T>
        </View>
      ))}
    </Card>
  );
}

export function OpenBadge({ spec }) {
  const { t } = useTheme();
  const open = isOpenNow(spec);
  if (open == null) return null;
  const left = open ? minutesUntilClose(spec) : null;
  return <Stamp label={open ? (left != null && left <= 60 ? `Closes in ${left}m` : 'Open now') : 'Closed'} color={open ? (left != null && left <= 60 ? t.warn : t.ok) : t.pencil} />;
}

/* ---------- Event ---------- */
export function EventSheet({ ev, onClose }) {
  const { t } = useTheme();
  const { isSaved, toggleSave, addEventToSchedule, setSheet, showToast } = useApp();
  const saved = isSaved(ev.id);
  const b = ev.buildingId ? buildingById(ev.buildingId) : null;
  return (
    <Sheet title={ev.title} hand={metaLine(ev.org, ev.date, ev.time)} onClose={onClose}
      footer={(
        <View style={{ flexDirection: 'row' }}>
          <Button title={saved ? 'Saved' : 'Save'} icon="bookmark" kind={saved ? 'highlight' : 'ghost'} onPress={() => toggleSave(ev)} style={{ flex: 1, marginRight: 8 }} />
          <Button title="Add to today" icon="calendarPlus" onPress={() => { addEventToSchedule(ev); onClose(); }} style={{ flex: 1 }} disabled={!ev.time || !/today|tonight/i.test(ev.date || '')} />
        </View>
      )}>
      {ev.img ? <Image source={{ uri: ev.img }} style={{ width: '100%', height: 170, borderRadius: 6, marginBottom: 12, backgroundColor: t.paperDeep }} resizeMode="cover" /> : null}
      <PostIt color="yellow" seed={ev.id} tape>
        <PT kind="body">{ev.desc || 'No description was posted for this one.'}</PT>
        {ev.location || b ? <PT kind="small" style={{ marginTop: 8 }}>📍 {ev.location || b?.name}</PT> : null}
      </PostIt>
      <View style={{ marginTop: 16 }}>
        {b ? <Row title="Walking directions" meta={metaLine(b.name, walkLabel(b))} left={<Icon name="walk" color={t.ink} />} onPress={() => openDirections(b)} /> : null}
        {ev.sourceUrl ? <Row title="Original listing" meta="Opens the source page" left={<Icon name="link" color={t.ink} />} onPress={() => openUrl(ev.sourceUrl)} /> : null}
        {ev.startsAt ? <Row title="Add to my calendar" meta="Into your Flyer calendar, with a reminder" left={<Icon name="calendarPlus" color={t.ink} />} onPress={async () => { try { const r = await addEventToCalendar({ title: ev.title, startsAt: ev.startsAt, location: ev.location || b?.name || '', notes: ev.desc || '', url: ev.sourceUrl || '' }); showToast(r === 'already' ? "It's already on your calendar" : 'Added to your Flyer calendar'); } catch (e) { showToast(e.message); } }} /> : null}
        <Row title="Ask friends to go" meta="A quick poll they can answer even without Flyer" left={<Icon name="users" color={t.ink} />} onPress={() => setSheet({ type: 'planNew', kind: 'poll', title: `${ev.title}?`, options: ["I'm in", 'Maybe', "Can't"] })} />
        <Row title="Send to a friend" meta="A link with a preview card" left={<Icon name="share" color={t.ink} />} onPress={() => shareThing('event', { title: ev.title, when: metaLine(ev.date, ev.time), where: ev.location || b?.name || '', desc: ev.desc || '', url: ev.sourceUrl || '', img: ev.img || '', startsAt: ev.startsAt || '' })} last />
      </View>
      {!/today|tonight/i.test(ev.date || '') && ev.time ? <T kind="small" style={{ marginTop: 10 }}>"Add to today" only works on the day of the event.</T> : null}
    </Sheet>
  );
}

/* ---------- Org ---------- */
export function OrgSheet({ id, onClose }) {
  const { t } = useTheme();
  const { followedOrgIds, toggleFollow } = useApp();
  const o = ORGS.find((x) => x.id === id);
  const enrich = useCallable(api.enrichOrg, { orgName: o?.name }, null, { asArray: false, enabled: !!o });
  if (!o) return null;
  const following = followedOrgIds.includes(o.id);
  return (
    <Sheet title={o.name} hand={isGreek(o) ? 'Greek life' : o.tags} onClose={onClose}
      footer={<Button title={following ? 'Following' : 'Follow'} icon={following ? 'check' : 'plus'} kind={following ? 'highlight' : 'primary'} onPress={() => toggleFollow(o.id)} />}>
      {enrich.data?.image ? <Image source={{ uri: enrich.data.image }} style={{ width: '100%', height: 150, borderRadius: 6, marginBottom: 12, backgroundColor: t.paperDeep }} resizeMode="cover" /> : null}
      <PostIt color="pink" seed={o.id} tape>
        <PT kind="body">{o.reason || 'This organization hasn\'t posted a description.'}</PT>
      </PostIt>
      <View style={{ marginTop: 14 }}>
        {enrich.loading ? <Loading label="Looking for their socials…" /> : null}
        {enrich.data?.instagramUrl ? <Row title="Instagram" meta="Their real profile" left={<Icon name="camera" color={t.ink} />} onPress={() => openUrl(enrich.data.instagramUrl)} /> : null}
        {enrich.data?.activeSignal ? <T kind="small" style={{ marginTop: 6 }}>Activity: {enrich.data.activeSignal}</T> : null}
        <Row title="Find on TechConnect" meta="Official directory: join, events, officers" left={<Icon name="link" color={t.ink} />} onPress={() => openUrl(`https://techconnect.ttu.edu/organizations?query=${encodeURIComponent(o.name)}`)} last />
      </View>
      <T kind="small" style={{ marginTop: 10 }}>Meeting times aren't published in the directory export, so check TechConnect or their socials for when they meet.</T>
    </Sheet>
  );
}

/* ---------- Building ---------- */
export function BuildingSheet({ id, onClose }) {
  const { t } = useTheme();
  const { setSheet, scheduleItems } = useApp();
  const b = buildingById(id);
  if (!b) return null;
  const plan = floorPlanFor(b);
  const dining = DINING.filter((d) => d.buildingId === b.id);
  const stops = BUS_STOPS.filter((s) => s.buildingId === b.id);
  const resources = RESOURCES.filter((r) => r.buildingId === b.id);
  const myClasses = scheduleItems.filter((c) => c.buildingId === b.id);
  return (
    <Sheet title={b.name} hand={metaLine(catLabel(b.kind), walkLabel(b))} onClose={onClose}
      footer={<Button title="Walking directions" icon="walk" onPress={() => openDirections(b)} />}>
      <View style={{ flexDirection: 'row', marginBottom: 6 }}><OpenBadge spec={b.hours} /></View>
      {b.hours ? <HoursTable spec={b.hours} /> : <T kind="small">No posted hours for this building.</T>}

      {myClasses.length ? (
        <PostIt color="yellow" seed={`${b.id}-mine`} style={{ marginTop: 16 }}>
          <PT kind="tiny">Your classes here</PT>
          {myClasses.map((c) => <PT key={c.id} kind="bold" style={{ marginTop: 4 }}>{c.title} · {(c.days || []).join('/')} {c.time}{c.room ? ` · Rm ${c.room}` : ''}</PT>)}
        </PostIt>
      ) : null}

      <View style={{ marginTop: 16 }}>
        <Row title="Find a room here" meta="Which floor it's probably on, the doors students use, elevator status" left={<Icon name="door" color={t.ink} />} chevron onPress={() => setSheet({ type: 'rooms', buildingId: b.id, query: b.name })} />
        {plan ? <Row title={plan.label} meta="Official public floor maps" left={<Icon name="layers" color={t.ink} />} onPress={() => openUrl(plan.url)} /> : null}
        {dining.map((d) => <Row key={d.id} title={d.name} meta="Dining inside" left={<Icon name="food" color={t.ink} />} onPress={() => setSheet({ type: 'dining', id: d.id })} />)}
        {resources.map((r) => <Row key={r.id} title={r.name} meta={r.kind} left={<Icon name="help" color={t.ink} />} onPress={r.url ? () => openUrl(r.url) : undefined} />)}
        {stops.map((s) => <Row key={s.id} title={`Citibus stop: ${s.name}`} meta={`${s.route} route · tap for routes and live tracking`} left={<Icon name="bus" color={t.ink} />} onPress={() => setSheet({ type: 'bus', id: s.id })} chevron />)}
      </View>
      <T kind="tiny" style={{ marginTop: 16, marginBottom: 6 }}>Right now</T>
      <StatusTaps placeId={b.id} kinds={['elevator', 'printer', 'seats', 'wifi']} />
      <BuildingTips buildingId={b.id} max={4} />
      <LastChecked date={CHECKED.buildings} source="Hours from the building's TTU page" itemId={`building:${b.id}`} title={b.name} />
    </Sheet>
  );
}

/* ---------- Dining ---------- */
export function DiningSheet({ id, onClose }) {
  const d = DINING.find((x) => x.id === id);
  const detail = useCallable(api.getDiningHallDetail, { hallName: d?.venue }, null, { asArray: false, enabled: !!d && !d.concepts?.length });
  if (!d) return null;
  const b = d.buildingId ? buildingById(d.buildingId) : null;
  const vendors = d.concepts?.length ? d.concepts : (detail.data?.vendors || []);
  return (
    <Sheet title={d.name} hand={metaLine(d.venue, b ? walkLabel(b) : null)} onClose={onClose}
      footer={b ? <Button title="Walking directions" icon="walk" onPress={() => openDirections(b)} /> : null}>
      <View style={{ flexDirection: 'row', marginBottom: 6 }}><OpenBadge spec={d.hours} /></View>
      <HoursTable spec={d.hours} />
      <T kind="tiny" style={{ marginTop: 16, marginBottom: 6 }}>Inside</T>
      {detail.loading && !d.concepts?.length ? <Loading label="Checking what's inside…" /> : vendors.length ? (
        <PostIt color="orange" seed={d.id}>
          {vendors.map((v) => <PT key={v} kind="body" style={{ paddingVertical: 2 }}>• {v}</PT>)}
        </PostIt>
      ) : <T kind="small">Single-location spot, no separate stations listed.</T>}
      <T kind="small" style={{ marginTop: 10 }}>Hours from TTU Hospitality Services. Holidays and breaks can change them.</T>
      <LastChecked date={CHECKED.dining} source="TTU Hospitality Services" itemId={`dining:${d.id}`} title={d.name} />
    </Sheet>
  );
}
