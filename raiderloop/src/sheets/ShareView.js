/**
 * What opens when a friend texts you a Flyer link (flyer.app/s/…) and
 * you already have the app: the same card their friends without the
 * app see as a preview, plus the buttons that only work in the app.
 */
import React, { useEffect, useState } from 'react';
import { View, Image } from 'react-native';
import { Sheet, PostIt, PT, Button, Loading, Empty } from '../ui/Paper';
import { Washi } from '../ui/Scrap';
import { SectionNote } from '../ui/Kit';
import { useApp } from '../state/AppContext';
import { api } from '../lib/firebase';
import { openUrl } from '../lib/links';
import { findRoom } from '../lib/rooms';
import { addEventToCalendar } from '../lib/calendarExport';
import { shareThing } from '../lib/share';
import { ReportSheet } from './Report';

const KIND_LABEL = { event: 'Event', plan: 'Plan', deal: 'Deal', place: 'Place', tip: 'Good to know', group: 'Group', card: 'Connect card', post: 'Post', queue: 'Office hours' };
const KIND_COLOR = { event: 'yellow', plan: 'green', deal: 'orange', place: 'blue', tip: 'lavender', group: 'pink', card: 'blue', post: 'yellow', queue: 'green' };

export function ShareViewSheet({ id, onClose }) {
  const { setSheet, showToast, roomAliases } = useApp();
  const [s, setS] = useState(null);
  const [err, setErr] = useState('');
  const [report, setReport] = useState(false);
  useEffect(() => {
    api.getShare({ id }).then((r) => setS(r.data)).catch((e) => setErr(e.message || "That link didn't open."));
  }, [id]);
  if (err) return <Sheet title="Shared with you" onClose={onClose} height={0.5}><Empty icon="link" title="That link didn't open" body={err} /></Sheet>;
  if (!s) return <Sheet title="Shared with you" onClose={onClose} height={0.5}><Loading /></Sheet>;
  const d = s.data || {};
  const place = d.where ? findRoom(d.where, roomAliases) : null;
  const building = place && place.confidence >= 0.6 ? place.building : null;
  const startsAt = d.startsAt && !Number.isNaN(new Date(d.startsAt).getTime()) ? d.startsAt : null;
  /* If the share points at something Flyer can open (a plan, a group,
     a Discover post), offer that first. */
  const ref = d.ref || '';
  const openRef = () => {
    if (s.kind === 'plan' && ref) setSheet({ type: 'plan', id: ref });
    else if (s.kind === 'group' && ref) setSheet({ type: 'group', code: ref });
    else if (s.kind === 'queue' && ref) setSheet({ type: 'queue', code: ref });
    else if ((s.kind === 'event' || s.kind === 'tip' || s.kind === 'deal') && ref) setSheet({ type: 'publicPost', id: ref });
  };
  const toCalendar = async () => {
    try { const r = await addEventToCalendar({ title: d.title, startsAt, location: d.where, notes: d.desc, url: d.url }); showToast(r === 'already' ? "It's already on your calendar" : 'Added to your Flyer calendar'); } catch (e) { showToast(e.message); }
  };
  return (
    <Sheet title="Shared with you" hand={d.by ? `from ${d.by}` : undefined} onClose={onClose} height={0.8}>
      <PostIt color={KIND_COLOR[s.kind] || 'yellow'} tilt={-1} seed={id}>
        <Washi width={70} angle={-5} />
        <PT kind="tiny">{KIND_LABEL[s.kind] || 'Shared'}</PT>
        <PT kind="title">{d.title}</PT>
        {d.when ? <PT kind="bold" style={{ marginTop: 4 }}>{d.when}</PT> : null}
        {d.where ? <PT kind="small">{d.where}{building && building.name !== d.where ? ` · ${building.name}` : ''}</PT> : null}
        {d.desc ? <PT style={{ marginTop: 8 }}>{d.desc}</PT> : null}
        {d.img ? <Image source={{ uri: d.img }} style={{ width: '100%', height: 170, borderRadius: 8, marginTop: 10 }} resizeMode="cover" /> : null}
      </PostIt>
      <View style={{ marginTop: 16 }}>
        {ref && ['plan', 'group', 'queue', 'event', 'tip', 'deal'].includes(s.kind) ? <Button title={s.kind === 'plan' ? 'Open the plan and vote' : s.kind === 'group' ? 'Open the group' : s.kind === 'queue' ? 'Get in line' : 'Open in Discover'} icon="arrow" onPress={openRef} style={{ marginBottom: 8 }} /> : null}
        {startsAt ? <Button title="Add to my calendar" icon="calendar" kind="ghost" onPress={toCalendar} style={{ marginBottom: 8 }} /> : null}
        {building ? <Button title={`Find ${place.room ? `room ${place.room}` : building.name}`} icon="pin" kind="ghost" onPress={() => setSheet({ type: 'rooms', query: d.where })} style={{ marginBottom: 8 }} /> : null}
        {!building && d.where ? <Button title="Directions" icon="pin" kind="ghost" onPress={() => openUrl(`https://maps.apple.com/?q=${encodeURIComponent(`${d.where}, Lubbock TX`)}`)} style={{ marginBottom: 8 }} /> : null}
        {d.url ? <Button title="Open the link" icon="link" kind="ghost" onPress={() => openUrl(d.url)} style={{ marginBottom: 8 }} /> : null}
        <Button title="Pass it on" icon="share" kind="ghost" onPress={() => shareThing(s.kind, d)} />
      </View>
      <SectionNote icon="flag" onPress={() => setReport(true)}>Something wrong with this? Tap to report it.</SectionNote>
      {report ? <ReportSheet kind="other" id={id} onClose={() => setReport(false)} /> : null}
    </Sheet>
  );
}
