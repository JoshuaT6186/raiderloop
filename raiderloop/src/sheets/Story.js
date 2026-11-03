/**
 * Friends-only posts, your Story, your College Journey, and Postcards.
 *   • A post shows in friends' feeds for 24 hours, then leaves.
 *   • Save any post to your Story to keep it (friends can see Stories).
 *   • Your College Journey is every photo you've posted, by semester,
 *     just for you.
 *   • A Postcard is a photo pinned to the spot you took it, so friends
 *     see it on their map. A Postcard of a building can also become a
 *     public "door you actually use" tip (objects and places only).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Pressable, ScrollView, Modal, SafeAreaView } from 'react-native';
import {
  Sheet, T, PostIt, PT, Card, Button, Field, Loading, Empty, Toggle,
} from '../ui/Paper';
import { Polaroid } from '../ui/Scrap';
import { FolderTabs, SectionNote, StampThunk, RubberStamp } from '../ui/Kit';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import { useTheme } from '../theme/ThemeContext';
import { SCREEN_W, SCREEN_H } from '../theme/tokens';
import { useApp } from '../state/AppContext';
import { api } from '../lib/firebase';
import { pickPhoto, upload, uploadError } from '../lib/upload';
import { currentPosition } from '../lib/location';
import { BUILDINGS, distanceM } from '../data/campus';
import { ReportSheet } from './Report';

export const timeLeft = (iso) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'gone';
  const h = Math.floor(ms / 3600000); const m = Math.round((ms % 3600000) / 60000);
  return h ? `gone in ${h}h ${m}m` : `gone in ${m}m`;
};
const dayLabel = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const semesterOf = (ms) => {
  const d = new Date(ms); const m = d.getMonth() + 1; const y = d.getFullYear();
  return m >= 8 ? `Fall '${String(y).slice(2)}` : m <= 5 ? `Spring '${String(y).slice(2)}` : `Summer '${String(y).slice(2)}`;
};

export async function nearestPlace() {
  const pos = await currentPosition();
  if (!pos) return null;
  let best = null;
  for (const b of BUILDINGS) {
    const d = distanceM(pos, b);
    if (d != null && d < 160 && (!best || d < best.d)) best = { b, d };
  }
  return best ? { name: best.b.name, buildingId: best.b.id, lat: pos.lat, lng: pos.lng } : { name: 'Near campus', buildingId: null, lat: pos.lat, lng: pos.lng };
}

/* ---------- Compose ---------- */
export function ComposeSheet({ kind = 'moment', hunt, item, onClose, onPosted }) {
  const { t } = useTheme();
  const { showToast, user, setSheet } = useApp();
  const [photo, setPhoto] = useState(null);
  const [caption, setCaption] = useState('');
  const [place, setPlace] = useState(null);
  const [alsoTip, setAlsoTip] = useState(false);
  const [busy, setBusy] = useState(false);
  const [earned, setEarned] = useState(null);
  const pinned = kind === 'postcard';
  useEffect(() => { if (pinned || kind === 'hunt') nearestPlace().then(setPlace).catch(() => {}); }, [kind]);
  const pick = async (camera) => { try { const p = await pickPhoto({ camera }); if (p) setPhoto(p); } catch (e) { showToast(uploadError(e)); } };
  const post = async () => {
    setBusy(true);
    try {
      const uploadPath = await upload(photo);
      const r = await api.createPost({ kind, uploadPath, caption, place, alsoTip: pinned && alsoTip, huntId: hunt?.id, itemId: item?.id });
      if (r.data.points) setEarned(r.data.points); else { showToast(pinned ? 'Postcard pinned for friends' : 'Posted for 24 hours'); onPosted && onPosted(); onClose(); }
    } catch (e) { showToast(uploadError(e)); }
    setBusy(false);
  };
  if (!user || user.isAnonymous) {
    return <Sheet title="Posts" onClose={onClose}><PostIt color="yellow" tape><PT kind="bold">Posting needs an account</PT><Button title="Make an account" small onPress={() => setSheet({ type: 'account' })} style={{ marginTop: 10 }} /></PostIt></Sheet>;
  }
  const title = kind === 'hunt' ? item?.label : pinned ? 'New Postcard' : 'New post';
  const hand = kind === 'hunt' ? `${hunt?.title} · objects and places only, never people` : pinned ? 'Pinned where you are, on your friends\' maps' : 'Friends only · leaves the feed after 24 hours';
  return (
    <Sheet title={title} hand={hand} onClose={onClose} height={0.94}
      footer={earned ? <Button title="Nice!" onPress={() => { onPosted && onPosted(); onClose(); }} /> : <Button title={kind === 'hunt' ? 'Check it' : pinned ? 'Pin it' : 'Post'} icon={pinned ? 'pin' : 'send'} loading={busy} disabled={!photo} onPress={post} />}>
      {earned ? (
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <StampThunk play><RubberStamp label={`+${earned}`} sub="points" size={120} color={t.ok} /></StampThunk>
          <T kind="handBig" style={{ marginTop: 16 }}>{kind === 'hunt' ? 'Found it!' : 'Nice one!'}</T>
        </View>
      ) : (
        <>
          {photo ? (
            <Polaroid uri={photo.uri} caption={caption || ' '} sub={place?.name} photoHeight={260} tilt={-1.5} onPress={() => setPhoto(null)} />
          ) : (
            <PostIt color="blue" tilt={-1} style={{ alignItems: 'center', paddingVertical: 30 }}>
              <Icon name="camera" size={40} color="#1F2A44" />
              <View style={{ flexDirection: 'row', marginTop: 14 }}>
                <Button title="Take a pic" icon="camera" small onPress={() => pick(true)} style={{ marginRight: 8 }} />
                <Button title="Library" icon="image" small kind="ghost" onPress={() => pick(false)} style={{ backgroundColor: '#fff' }} />
              </View>
            </PostIt>
          )}
          <Field label="Caption" value={caption} onChangeText={setCaption} maxLength={300} placeholder={kind === 'hunt' ? 'Where did you find it?' : 'Say something'} style={{ marginTop: 16 }} />
          {pinned ? (
            <>
              <Card style={{ marginBottom: 12 }}>
                <T kind="tiny">Pinned at</T>
                <T kind="bold">{place ? place.name : 'Finding your spot…'}</T>
                <T kind="small">Friends see this spot on their map (rounded to about 10 m). You can turn Postcards off in You → Me.</T>
              </Card>
              {place && place.buildingId ? (
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <T kind="bold">Also share as a tip for {place.name}</T>
                      <T kind="small">Public, under "Good to Know". Great for "the door you actually use". No people in the photo.</T>
                    </View>
                    <Toggle value={alsoTip} onChange={setAlsoTip} label="Also share as a public tip" />
                  </View>
                </Card>
              ) : null}
            </>
          ) : null}
          <SectionNote icon="shield">Every photo is checked before friends see it. Posts are friends-only.</SectionNote>
        </>
      )}
    </Sheet>
  );
}

/* ---------- Friends' Stories row ---------- */
export function storiesByPerson(feed) {
  const by = {};
  feed.forEach((p) => { (by[p.uid] = by[p.uid] || { uid: p.uid, name: p.name, avatar: p.avatar, posts: [] }).posts.push(p); });
  return Object.values(by).map((x) => ({ ...x, posts: x.posts.sort((a, b) => a.createdMs - b.createdMs), latest: Math.max(...x.posts.map((p) => p.createdMs || 0)) })).sort((a, b) => b.latest - a.latest);
}

export function StoriesRow({ onOpen }) {
  const { t } = useTheme();
  const { feed, setSheet, avatar } = useApp();
  const people = useMemo(() => storiesByPerson(feed), [feed]);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6 }}>
      <Pressable onPress={() => setSheet({ type: 'story' })} style={{ alignItems: 'center', marginRight: 14, width: 62 }} accessibilityLabel="My Story">
        <View style={{ borderWidth: 2, borderColor: t.border, borderStyle: 'dashed', borderRadius: 32, padding: 2 }}><Avatar config={avatar} size={52} /></View>
        <T kind="small" style={{ fontSize: 11 }}>See mine</T>
      </Pressable>
      {people.map((p) => (
        <Pressable key={p.uid} onPress={() => onOpen(p)} style={{ alignItems: 'center', marginRight: 14, width: 62 }} accessibilityLabel={`${p.name}'s posts`}>
          <View style={{ borderWidth: 3, borderColor: t.highlight, borderRadius: 32, padding: 2 }}><Avatar config={p.avatar} size={50} /></View>
          <T kind="small" style={{ fontSize: 11 }} numberOfLines={1}>{(p.name || '').split(' ')[0]}</T>
        </Pressable>
      ))}
      {!people.length ? <View style={{ justifyContent: 'center' }}><T kind="small" color={t.pencil}>Friends' posts show up here for 24 hours.</T></View> : null}
    </ScrollView>
  );
}

/* ---------- Full-screen viewer ---------- */
export function StoryViewer({ person, posts, onClose }) {
  const [i, setI] = useState(0);
  const [report, setReport] = useState(false);
  const p = posts[i];
  if (!p) return null;
  const next = () => (i < posts.length - 1 ? setI(i + 1) : onClose());
  const prev = () => (i > 0 ? setI(i - 1) : null);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(20,24,36,0.94)' }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingTop: 8 }}>
            {posts.map((x, k) => <View key={x.id || x.postId || k} style={{ flex: 1, height: 3, marginHorizontal: 2, borderRadius: 2, backgroundColor: k <= i ? '#FFE45C' : 'rgba(255,255,255,0.3)' }} />)}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
            <Avatar config={person.avatar} size={36} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <T kind="bold" color="#fff">{person.name}</T>
              <T kind="small" color="#CFCBBD">{[p.place?.name, p.expiresAt ? timeLeft(p.expiresAt) : dayLabel(p.createdMs)].filter(Boolean).join(' · ')}</T>
            </View>
            {person.uid ? <Pressable onPress={() => setReport(true)} hitSlop={12} accessibilityLabel="Report" style={{ marginRight: 16 }}><Icon name="flag" size={20} color="#CFCBBD" /></Pressable> : null}
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close"><Icon name="close" size={24} color="#fff" /></Pressable>
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }}>
            <Polaroid uri={p.photoUrl} caption={p.caption || ' '} sub={p.itemLabel ? `Hunt: ${p.itemLabel}` : p.kind === 'postcard' ? 'Postcard' : null} photoHeight={Math.min(SCREEN_H * 0.5, SCREEN_W)} tilt={-1} style={{ width: SCREEN_W - 50 }} />
          </View>
          <View style={{ position: 'absolute', top: 120, bottom: 60, left: 0, width: '35%' }}><Pressable style={{ flex: 1 }} onPress={prev} accessibilityLabel="Previous" /></View>
          <View style={{ position: 'absolute', top: 120, bottom: 60, right: 0, width: '65%' }}><Pressable style={{ flex: 1 }} onPress={next} accessibilityLabel="Next" /></View>
        </SafeAreaView>
      </View>
      {report ? <ReportSheet kind="post" id={p.postId || p.id} uid={person.uid} name={person.name} onClose={() => setReport(false)} onDone={onClose} /> : null}
    </Modal>
  );
}

/* ---------- My Story / a friend's Story / College Journey ---------- */
function MyPostTile({ p }) {
  const { showToast } = useApp();
  const [open, setOpen] = useState(false);
  const toggleSave = async () => { try { await api.savePost({ id: p.id, saved: !p.saved }); showToast(p.saved ? 'Removed from your Story' : 'Saved to your Story'); } catch (e) { showToast(e.message); } };
  const del = async () => { try { await api.deletePost({ id: p.id }); showToast('Deleted'); setOpen(false); } catch (e) { showToast(e.message); } };
  const live = p.expiresAt && new Date(p.expiresAt) > new Date();
  return (
    <View style={{ width: '48%', marginBottom: 16 }}>
      <Polaroid uri={p.photoUrl} caption={p.caption || ' '} sub={[p.place?.name, dayLabel(p.createdMs)].filter(Boolean).join(' · ')} photoHeight={130} seed={p.id} onPress={() => setOpen(true)}
        stamp={p.saved ? <Icon name="bookmark" size={16} color="#1F2A44" fill="#FFE45C" /> : null} />
      {open ? (
        <Sheet title={p.caption || 'Your post'} hand={live ? `On friends' feeds · ${timeLeft(p.expiresAt)}` : p.saved ? 'In your Story' : 'Only you see this now (College Journey)'} onClose={() => setOpen(false)} height={0.85}
          footer={(
            <View style={{ flexDirection: 'row' }}>
              <Button title={p.saved ? 'Remove from Story' : 'Save to Story'} icon="bookmark" kind={p.saved ? 'ghost' : 'primary'} onPress={toggleSave} style={{ flex: 1, marginRight: 8 }} />
              <Button title="Delete" kind="danger" onPress={del} style={{ flex: 0.6 }} />
            </View>
          )}>
          <Polaroid uri={p.photoUrl} caption={p.caption || ' '} sub={p.place?.name} photoHeight={300} tilt={-1} tape />
        </Sheet>
      ) : null}
    </View>
  );
}

export function StorySheet({ uid, name, onClose }) {
  const { t } = useTheme();
  const { user, myPosts, setSheet } = useApp();
  const mine = !uid || uid === user?.uid;
  const [tab, setTab] = useState('story');
  const [theirs, setTheirs] = useState(null);
  const [view, setView] = useState(null);
  useEffect(() => { if (!mine) api.getStory({ uid }).then((r) => setTheirs(r.data.posts)).catch(() => setTheirs([])); }, [uid]);
  const saved = mine ? myPosts.filter((p) => p.saved) : (theirs || []);
  const bySemester = useMemo(() => {
    const groups = {};
    myPosts.forEach((p) => { const k = semesterOf(p.createdMs); (groups[k] = groups[k] || []).push(p); });
    return Object.entries(groups);
  }, [myPosts]);
  return (
    <Sheet title={mine ? 'Your Story' : `${(name || '').split(' ')[0]}'s Story`} hand="Friends only" onClose={onClose} height={0.94}
      footer={mine ? (
        <View style={{ flexDirection: 'row' }}>
          <Button title="New post" icon="camera" onPress={() => setSheet({ type: 'compose', kind: 'moment' })} style={{ flex: 1, marginRight: 8 }} />
          <Button title="Postcard" icon="pin" kind="ghost" onPress={() => setSheet({ type: 'compose', kind: 'postcard' })} style={{ flex: 1 }} />
        </View>
      ) : null}>
      {mine ? <FolderTabs small value={tab} onChange={setTab} tabs={[{ id: 'story', label: 'Story', icon: 'bookmark', color: 'pink' }, { id: 'journey', label: 'College Journey', icon: 'route', color: 'lavender' }]} /> : null}
      {tab === 'story' || !mine ? (
        !mine && theirs === null ? <Loading /> : saved.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {saved.map((p) => (mine ? <MyPostTile key={p.id} p={p} /> : (
              <View key={p.id} style={{ width: '48%', marginBottom: 16 }}>
                <Polaroid uri={p.photoUrl} caption={p.caption || ' '} sub={[p.place?.name, dayLabel(p.createdMs)].filter(Boolean).join(' · ')} photoHeight={130} seed={p.id}
                  onPress={() => setView(saved.indexOf(p))} />
              </View>
            )))}
          </View>
        ) : <Empty icon="bookmark" title={mine ? 'Nothing saved yet' : 'Nothing here yet'} body={mine ? 'Posts leave the feed after 24 hours. Save any of them here to keep them.' : undefined} />
      ) : (
        bySemester.length ? bySemester.map(([sem, list]) => (
          <View key={sem} style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.highlight, borderWidth: 2, borderColor: '#1F2A44', marginRight: 8 }} />
              <T kind="handBig" style={{ fontSize: 26 }}>{sem}</T>
              <T kind="small" style={{ marginLeft: 8 }}>{list.length} {list.length === 1 ? 'photo' : 'photos'}</T>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', borderLeftWidth: 2, borderColor: t.border, borderStyle: 'dashed', paddingLeft: 12, marginLeft: 5 }}>
              {list.map((p) => <MyPostTile key={p.id} p={p} />)}
            </View>
          </View>
        )) : <Empty icon="route" title="Your College Journey starts with one photo" body="Every post you make lands here, by semester, just for you." />
      )}
      {view != null && !mine ? <StoryViewer person={{ uid, name }} posts={saved} onClose={() => setView(null)} /> : null}
    </Sheet>
  );
}
