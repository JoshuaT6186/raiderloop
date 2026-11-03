/**
 * Semester scrapbook: a notebook page Flyer puts together from your
 * semester. Photos you posted, places you pinned, stamps you earned,
 * classes you took, and people you met. Just for you (screenshot it
 * if you want to share).
 */
import React, { useMemo } from 'react';
import { View, Share } from 'react-native';
import { Sheet, T, PostIt, PT, Card, Button } from '../ui/Paper';
import { Polaroid, Washi, Pushpin } from '../ui/Scrap';
import { RubberStamp, Highlighter, SectionNote, Pill } from '../ui/Kit';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { STAMPS } from './Play';

export function seasonBounds(now = new Date()) {
  const m = now.getMonth() + 1; const y = now.getFullYear();
  if (m >= 8) return { id: `fall-${y}`, name: `Fall '${String(y).slice(2)}`, start: new Date(y, 7, 1), end: new Date(y, 11, 31, 23, 59) };
  if (m <= 5) return { id: `spring-${y}`, name: `Spring '${String(y).slice(2)}`, start: new Date(y, 0, 1), end: new Date(y, 4, 31, 23, 59) };
  return { id: `summer-${y}`, name: `Summer '${String(y).slice(2)}`, start: new Date(y, 5, 1), end: new Date(y, 6, 31, 23, 59) };
}

export function ScrapbookSheet({ onClose }) {
  const { t } = useTheme();
  const { myPosts, score, friends, groups, scheduleItems, going, savedEvents, userName, set } = useApp();
  const sem = seasonBounds();
  const inSem = (ms) => ms >= sem.start.getTime() && ms <= sem.end.getTime();
  const posts = useMemo(() => myPosts.filter((p) => inSem(p.createdMs || 0)).sort((a, b) => (b.saved ? 1 : 0) - (a.saved ? 1 : 0)), [myPosts]);
  const places = [...new Set(posts.map((p) => p.place?.name).filter(Boolean))];
  const newFriends = friends.filter((f) => { const ms = f.since?.toMillis ? f.since.toMillis() : f.since?.seconds ? f.since.seconds * 1000 : 0; return ms && inSem(ms); });
  const classes = [...new Set(scheduleItems.filter((c) => !c.oneOff).map((c) => c.title))];
  const stamps = (score && score.season === sem.id ? score.stamps : []) || [];
  const points = score && score.season === sem.id ? score.points : 0;
  React.useEffect(() => { set({ scrapbookSeen: sem.id }); }, []);
  const share = () => Share.share({ message: `My ${sem.name} on Flyer: ${posts.length} photos, ${places.length} places, ${stamps.length} stamps, ${newFriends.length} new friends, ${points} Flight Score points. ✈︎` }).catch(() => {});
  return (
    <Sheet title={`${sem.name} scrapbook`} hand={`${(userName || 'Your').split(' ')[0]}'s semester, so far`} onClose={onClose} height={0.96}
      footer={<Button title="Share the highlights" icon="share" kind="ghost" onPress={share} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <PT kind="tiny" style={{ color: t.pencil }}>Flight Score</PT>
          <Highlighter><T kind="marker" style={{ fontSize: 40, lineHeight: 48 }}>{points.toLocaleString()}</T></Highlighter>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {stamps.slice(0, 3).map((s, i) => { const def = STAMPS.find((x) => x.id === s.id) || { label: s.id, color: '#C8413B' }; return <View key={s.id} style={{ marginLeft: -10 }}><RubberStamp label={def.label} color={def.color} size={64} tilt={i % 2 ? 8 : -10} /></View>; })}
        </View>
      </View>

      {posts.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 16 }}>
          {posts.slice(0, 9).map((p, i) => (
            <View key={p.id} style={{ width: i === 0 ? '100%' : '48%', marginBottom: 18 }}>
              <Polaroid uri={p.photoUrl} caption={p.caption || ' '} sub={p.place?.name} photoHeight={i === 0 ? 220 : 120} seed={p.id} tape={i % 3 !== 1} />
              {i % 3 === 1 ? <View style={{ position: 'absolute', top: -6, left: '46%' }}><Pushpin color={['#E0533F', '#2F5BD3', '#3FA66A'][i % 3]} /></View> : null}
            </View>
          ))}
        </View>
      ) : (
        <PostIt color="blue" tilt={-1} style={{ marginTop: 16 }}><PT>Your photos from this semester will show up here. Post a moment or pin a Postcard to start.</PT></PostIt>
      )}

      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        <PostIt color="yellow" tilt={-1.5} style={{ flex: 1, marginRight: 10 }}>
          <Washi width={50} angle={4} />
          <PT kind="tiny">Places</PT>
          <PT kind="title">{places.length}</PT>
          <PT kind="small" numberOfLines={3}>{places.slice(0, 4).join(', ') || 'Pin a Postcard somewhere'}</PT>
        </PostIt>
        <PostIt color="pink" tilt={1.2} style={{ flex: 1 }}>
          <Washi width={50} angle={-4} />
          <PT kind="tiny">New friends</PT>
          <PT kind="title">{newFriends.length}</PT>
          <PT kind="small" numberOfLines={3}>{newFriends.slice(0, 4).map((f) => (f.name || '').split(' ')[0]).join(', ') || 'Say hi to someone'}</PT>
        </PostIt>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 14 }}>
        <PostIt color="green" tilt={0.8} style={{ flex: 1, marginRight: 10 }}>
          <PT kind="tiny">Events</PT>
          <PT kind="title">{going.length + savedEvents.length}</PT>
          <PT kind="small">going or saved</PT>
        </PostIt>
        <PostIt color="lavender" tilt={-0.8} style={{ flex: 1 }}>
          <PT kind="tiny">Groups</PT>
          <PT kind="title">{groups.length}</PT>
          <PT kind="small" numberOfLines={2}>{groups.map((g) => g.name).slice(0, 2).join(', ') || 'Make one for a project'}</PT>
        </PostIt>
      </View>
      {classes.length ? (
        <Card style={{ marginTop: 16 }}>
          <T kind="tiny" style={{ marginBottom: 6 }}>Classes this semester</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{classes.map((c) => <Pill key={c} label={c} />)}</View>
        </Card>
      ) : null}
      <SectionNote icon="lock">Only you see this page. Screenshot it if you want to share.</SectionNote>
    </Sheet>
  );
}
