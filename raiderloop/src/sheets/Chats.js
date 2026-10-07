/**
 * Chat with friends, and flocks (small invite-only group chats).
 * ------------------------------------------------------------
 * Messages go through the server, which filters slurs, checks photos
 * before anyone sees them, and enforces friends-only DMs. Every
 * message disappears after 30 days. Hold any message to report it,
 * hide it, or block the sender.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, TextInput, Pressable, Alert, Image, ActivityIndicator } from 'react-native';
import { Sheet, T, PostIt, PT, Button, Row, Field, Empty, Toggle, Divider, Loading } from '../ui/Paper';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { ImagePicker } from '../lib/native';
import {
  api, errText, listenMessages, uploadChatPhoto, photoUrl,
} from '../lib/firebase';
import { registerPush } from '../lib/push';
import { preparePhoto } from '../lib/photos';
import { MeetupCard } from './Meetups';
import { metaLine } from '../lib/time';

const FLOCK_MAX = 15;
const first = (n) => String(n || '').split(' ')[0];
const ago = (ms) => {
  if (!ms) return '';
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export function chatTitle(chat, me) {
  if (!chat) return '';
  if (chat.type === 'flock') return chat.name;
  const other = (chat.members || []).find((u) => u !== me);
  return (chat.memberCards && chat.memberCards[other]?.name) || 'Friend';
}
function chatAvatar(chat, me) {
  const other = (chat.members || []).find((u) => u !== me);
  return chat.memberCards && chat.memberCards[other]?.avatar;
}

/* ---------- List ---------- */
export function ChatsSheet({ onClose }) {
  const { t } = useTheme();
  const { chats, user, chatRead, setSheet, friends } = useApp();
  const me = user?.uid;
  useEffect(() => { registerPush({ ask: true }).catch(() => {}); }, []);
  if (!user || user.isAnonymous) {
    return (
      <Sheet title="Messages" onClose={onClose} height={0.5}>
        <PostIt color="yellow" tilt={-1} tape><PT kind="title">Messages need an account</PT></PostIt>
        <Button title="Make an account" icon="userPlus" onPress={() => setSheet({ type: 'account' })} style={{ marginTop: 12 }} />
      </Sheet>
    );
  }
  return (
    <Sheet title="Messages" hand="Friends and flocks. Messages vanish after 30 days." onClose={onClose} height={0.94}
      headerRight={<Button title="New flock" icon="plus" small kind="ghost" onPress={() => setSheet({ type: 'newFlock' })} style={{ marginRight: 4 }} />}>
      {chats.length ? chats.map((c, i) => {
        const unread = c.last && c.last.from && c.last.from !== me && (c.last.atMs || 0) > (chatRead[c.id] || 0);
        return (
          <Row key={c.id} title={chatTitle(c, me)} meta={c.last ? `${c.last.from === me ? 'You: ' : ''}${c.last.text}` : c.type === 'flock' ? `${c.members.length} in this flock` : 'Say hi'}
            left={c.type === 'flock' ? <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: t.postit.blue, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#1F2A44' }}><Icon name="flock" color="#1F2A44" /></View> : <Avatar config={chatAvatar(c, me)} size={42} />}
            right={(
              <View style={{ alignItems: 'flex-end' }}>
                <T kind="small" style={{ fontSize: 11 }}>{ago(c.last?.atMs || c.updatedMs)}</T>
                {unread ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.redPen, marginTop: 4 }} /> : null}
              </View>
            )}
            onPress={() => setSheet({ type: 'chat', chatId: c.id })} chevron={false} last={i === chats.length - 1} />
        );
      }) : <Empty icon="chat" title="No messages yet" body={friends.length ? 'Open a friend and tap Message, or start a flock.' : 'Add friends first — messages are friends-only.'} />}
      {friends.length ? (
        <>
          <T kind="tiny" style={{ marginTop: 18, marginBottom: 6 }}>Message a friend</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {friends.map((f) => (
              <Pressable key={f.uid} onPress={() => setSheet({ type: 'chat', withUid: f.uid })} style={{ alignItems: 'center', marginRight: 12 }} accessibilityLabel={`Message ${f.name}`}>
                <Avatar config={f.avatar} size={46} />
                <T kind="small" style={{ fontSize: 11 }}>{first(f.name)}</T>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}
    </Sheet>
  );
}

/* ---------- Message bubbles ---------- */
function PhotoBubble({ path }) {
  const { t } = useTheme();
  const [url, setUrl] = useState(null);
  useEffect(() => { photoUrl(path).then(setUrl).catch(() => setUrl(false)); }, [path]);
  if (url === false) return <T kind="small">Photo unavailable</T>;
  if (!url) return <View style={{ width: 200, height: 150, alignItems: 'center', justifyContent: 'center', backgroundColor: t.paperDeep, borderRadius: 10 }}><ActivityIndicator color={t.accent} /></View>;
  return <Image source={{ uri: url }} style={{ width: 220, height: 220, borderRadius: 10, backgroundColor: t.paperDeep }} resizeMode="cover" accessibilityLabel="Photo" />;
}

function CardBubble({ card, onOpen }) {
  const { meetups, addClass, showToast, goToBuilding, setSheet } = useApp();
  if (card.type === 'meetup') {
    const m = meetups.find((x) => x.id === card.meetupId);
    if (m) return <MeetupCard m={m} compact onOpen={() => setSheet({ type: 'meetup', id: m.id })} />;
    return <PostIt color="blue" seed={card.meetupId} padding={10}><PT kind="tiny">Meetup</PT><PT kind="bold">{card.placeName}</PT><PT kind="small">{new Date(card.atMs).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })} · ended or canceled</PT></PostIt>;
  }
  if (card.type === 'class') {
    return (
      <PostIt color="yellow" seed={card.title} padding={10} onPress={() => Alert.alert(card.title, 'Add this class to your planner?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Add', onPress: () => { addClass({ title: card.title, days: card.days, time: card.time, endTime: card.endTime, place: card.place, buildingId: card.buildingId, type: 'class' }); showToast('Added to your planner'); } }])}>
        <PT kind="tiny">Class</PT><PT kind="bold">{card.title}</PT><PT kind="small">{metaLine((card.days || []).join('/'), card.time, card.place)}</PT><PT kind="small" style={{ marginTop: 2 }}>Tap to add to your planner</PT>
      </PostIt>
    );
  }
  if (card.type === 'place') {
    return <PostIt color="green" seed={card.placeId} padding={10} onPress={() => { onOpen && onOpen(); goToBuilding(card.placeId); }}><PT kind="tiny">Place</PT><PT kind="bold">{card.name}</PT><PT kind="small">Tap to see it on the map</PT></PostIt>;
  }
  if (card.type === 'event') {
    return <PostIt color="pink" seed={card.title} padding={10}><PT kind="tiny">Event</PT><PT kind="bold">{card.title}</PT><PT kind="small">{metaLine(card.date, card.time, card.location)}</PT></PostIt>;
  }
  if (card.type === 'note') {
    return <PostIt color="lavender" seed={card.title} padding={10}><PT kind="tiny">Note</PT><PT kind="bold">{card.title}</PT><PT kind="small">{card.body}</PT></PostIt>;
  }
  return null;
}

/* ---------- One chat ---------- */
export function ChatSheet({ chatId: initialId, withUid, onClose }) {
  const { t } = useTheme();
  const app = useApp();
  const { chats, user, blocked, hiddenMsgs, set, markChatRead, showToast, setSheet, scheduleItems } = app;
  const me = user?.uid;
  const [chatId, setChatId] = useState(initialId || null);
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [attach, setAttach] = useState(false);
  const [info, setInfo] = useState(false);
  const scroller = useRef(null);

  useEffect(() => {
    if (chatId || !withUid) return;
    api.openDm({ uid: withUid }).then((r) => setChatId(r.data.chatId)).catch((e) => { showToast(errText(e)); onClose(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withUid]);
  useEffect(() => (chatId ? listenMessages(chatId, setMsgs) : undefined), [chatId]);
  useEffect(() => {
    if (!chatId || !msgs) return;
    markChatRead(chatId, Date.now());
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, msgs && msgs.length]);

  const chat = chats.find((c) => c.id === chatId);
  const visible = useMemo(() => (msgs || []).filter((m) => !m.hidden && !blocked.includes(m.from) && !hiddenMsgs.includes(m.id)), [msgs, blocked, hiddenMsgs]);

  const send = async (payload) => {
    if (!chatId) return;
    setBusy(true);
    try { await api.sendMessage({ chatId, ...payload }); setText(''); setAttach(false); } catch (e) { showToast(errText(e, "Couldn't send — try again.")); }
    setBusy(false);
  };
  const sendPhoto = async (fromCamera) => {
    if (!ImagePicker) { showToast('Photos need the full app build.'); return; }
    const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showToast(fromCamera ? 'Camera is off for Flyer in Settings.' : 'Photos are off for Flyer in Settings.'); return; }
    const opts = { quality: 0.6, mediaTypes: ['images'], allowsEditing: false };
    const res = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.[0]) return;
    setBusy(true);
    try {
      const a = await preparePhoto(res.assets[0]);
      const path = await uploadChatPhoto(chatId, a.uri);
      await api.sendMessage({ chatId, imagePath: path, w: a.width, h: a.height, text: text.trim() || null });
      setText(''); setAttach(false);
    } catch (e) { showToast(errText(e, "Couldn't send that photo.")); }
    setBusy(false);
  };
  const shareClass = () => {
    const classes = scheduleItems.filter((c) => !c.oneOff);
    if (!classes.length) { showToast('Add classes in the Planner first.'); return; }
    Alert.alert('Share a class', undefined, [
      ...classes.slice(0, 8).map((c) => ({ text: c.title, onPress: () => send({ card: { type: 'class', title: c.title, days: c.days, time: c.time, endTime: c.endTime, place: c.place, buildingId: c.buildingId } }) })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };
  const longPress = (m) => {
    if (m.kind === 'system') return;
    const mine = m.from === me;
    Alert.alert(mine ? 'Your message' : 'Message', undefined, [
      ...(mine ? [] : [
        { text: 'Report', onPress: () => Alert.prompt ? Alert.prompt('Report message', 'What\'s wrong with it? (optional)', (reason) => report(m, reason)) : report(m, '') },
        { text: 'Block sender', style: 'destructive', onPress: () => block(m.from) },
      ]),
      { text: 'Hide for me', onPress: () => set((p) => ({ hiddenMsgs: [...p.hiddenMsgs, m.id].slice(-500) })) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };
  const report = async (m, reason) => {
    try { await api.reportContent({ chatId, messageId: m.id, reason: reason || '' }); set((p) => ({ hiddenMsgs: [...p.hiddenMsgs, m.id].slice(-500) })); showToast('Reported — thanks. It\'s hidden for you.'); } catch (e) { showToast(errText(e)); }
  };
  const block = (uid) => Alert.alert('Block?', "They won't be able to find, add, or message you, and their messages are hidden. They aren't told.", [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Block', style: 'destructive', onPress: () => api.blockUser({ uid }).then(() => showToast('Blocked')).catch((e) => showToast(errText(e))) },
  ]);

  const nameOf = (uid) => first(chat?.memberCards?.[uid]?.name) || 'Someone';
  if (info && chat) return <FlockInfo chat={chat} onBack={() => setInfo(false)} onClose={onClose} />;

  return (
    <Sheet title={chat ? chatTitle(chat, me) : 'Chat'} hand={chat?.type === 'flock' ? `${chat.members.length} people · tap ⓘ for the flock` : 'Messages vanish after 30 days'} onClose={onClose} scroll={false} height={0.94}
      headerRight={chat ? (
        <Pressable onPress={() => (chat.type === 'flock' ? setInfo(true) : setInfo(true))} hitSlop={8} style={{ marginRight: 6, marginTop: 6 }} accessibilityLabel="Chat info"><Icon name="info" color={t.ink} /></Pressable>
      ) : null}
      footer={(
        <View>
          {attach ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
              <Button title="Photo" icon="image" small kind="ghost" onPress={() => sendPhoto(false)} style={{ marginRight: 6, marginBottom: 6 }} />
              <Button title="Camera" icon="camera" small kind="ghost" onPress={() => sendPhoto(true)} style={{ marginRight: 6, marginBottom: 6 }} />
              <Button title="Meetup" icon="users" small kind="ghost" onPress={() => setSheet(chat?.type === 'flock' ? { type: 'meetupNew', flockId: chatId } : { type: 'meetupNew', to: (chat?.members || []).filter((u) => u !== me) })} style={{ marginRight: 6, marginBottom: 6 }} />
              <Button title="Class" icon="schedule" small kind="ghost" onPress={shareClass} style={{ marginRight: 6, marginBottom: 6 }} />
              <Button title="Note" icon="pencil" small kind="ghost" onPress={() => { if (!text.trim()) { showToast('Type the note first, then tap Note.'); return; } send({ card: { type: 'note', title: text.trim().slice(0, 60), body: text.trim() } }); }} style={{ marginBottom: 6 }} />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.card, borderWidth: 2, borderColor: t.mode === 'dark' ? t.borderStrong : '#1F2A44', borderRadius: 16, paddingLeft: 6, paddingRight: 6, paddingVertical: 6 }}>
            <Pressable onPress={() => setAttach(!attach)} accessibilityLabel="Attach" style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: t.postit.green, borderWidth: 1.5, borderColor: '#1F2A44' }}>
              <Icon name={attach ? 'close' : 'plus'} size={18} color="#1F2A44" />
            </Pressable>
            <TextInput style={{ flex: 1, fontSize: 16, color: t.ink, paddingVertical: 6, paddingHorizontal: 10 }} placeholder={chat?.type === 'flock' ? `Message ${chat.name}` : 'Message'} placeholderTextColor={t.faint} value={text} onChangeText={setText} multiline maxLength={1000} />
            <Pressable onPress={() => text.trim() && send({ text })} disabled={busy || !text.trim()} accessibilityLabel="Send" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.highlight, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#1F2A44', opacity: text.trim() ? 1 : 0.5 }}>
              {busy ? <ActivityIndicator color="#1F2A44" /> : <Icon name="send" size={18} color="#1F2A44" />}
            </Pressable>
          </View>
          <T kind="small" style={{ fontSize: 11, marginTop: 6, textAlign: 'center' }}>Hold a message to report it or block the sender.</T>
        </View>
      )}>
      <ScrollView ref={scroller} style={{ height: 470 }} contentContainerStyle={{ paddingBottom: 10 }} keyboardShouldPersistTaps="handled">
        {msgs === null ? <Loading label="Opening…" /> : !visible.length ? <Empty icon="chat" title="No messages yet" body="Say hi, share a class, or send a meetup card." /> : visible.map((m, i) => {
          if (m.kind === 'system') return <T key={m.id} kind="small" style={{ textAlign: 'center', marginVertical: 6 }}>{m.text}</T>;
          const mine = m.from === me;
          const showName = chat?.type === 'flock' && !mine && visible[i - 1]?.from !== m.from;
          return (
            <Pressable key={m.id} onLongPress={() => longPress(m)} delayLongPress={350} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', marginBottom: 8 }}>
              {showName ? <T kind="small" style={{ fontSize: 11, marginBottom: 2 }}>{nameOf(m.from)}</T> : null}
              {m.kind === 'image' ? <PhotoBubble path={m.image.path} /> : null}
              {m.kind === 'card' ? <View style={{ minWidth: 220 }}><CardBubble card={m.card} onOpen={onClose} /></View> : null}
              {m.text && m.kind !== 'card' ? (
                <View style={{ backgroundColor: mine ? t.accent : t.card, borderRadius: 14, borderBottomRightRadius: mine ? 4 : 14, borderTopLeftRadius: mine ? 14 : 4, paddingHorizontal: 12, paddingVertical: 8, borderWidth: mine ? 0 : 1, borderColor: t.border, marginTop: m.kind === 'image' ? 4 : 0 }}>
                  <T color={mine ? t.accentInk : t.ink}>{m.text}</T>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

/* ---------- Chat / flock info ---------- */
function FlockInfo({ chat, onBack, onClose }) {
  const { t } = useTheme();
  const { user, friends, showToast, setSheet } = useApp();
  const me = user?.uid;
  const isFlock = chat.type === 'flock';
  const admin = isFlock && (chat.admins || []).includes(me);
  const [muted, setMuted] = useState(false);
  const [name, setName] = useState(chat.name || '');
  const [adding, setAdding] = useState(false);
  const run = async (fn, ok) => { try { await fn(); if (ok) showToast(ok); } catch (e) { showToast(errText(e)); } };
  const addable = friends.filter((f) => !(chat.members || []).includes(f.uid));
  const other = !isFlock ? (chat.members || []).find((u) => u !== me) : null;

  return (
    <Sheet title={isFlock ? chat.name : chatTitle(chat, me)} hand={isFlock ? `${chat.members.length} of ${FLOCK_MAX} people` : 'Direct message'} onClose={onClose} height={0.92}
      headerRight={<Button title="Back" small kind="ghost" onPress={onBack} style={{ marginRight: 4 }} />}>
      <Row title="Mute notifications" right={<Toggle value={muted} onChange={(v) => { setMuted(v); run(() => api.setChatMute({ chatId: chat.id, muted: v })); }} label="Mute" />} />
      {isFlock ? (
        <>
          <Row title="Flock score board" meta="Members who show their flight score" left={<Icon name="trophy" color={t.ink} />} onPress={() => setSheet({ type: 'flockBoard', flockId: chat.id })} />
          <Row title="Plan a flock meetup" left={<Icon name="users" color={t.ink} />} onPress={() => setSheet({ type: 'meetupNew', flockId: chat.id })} />
          <Row title="Find a time we're all free" meta="Uses schedules members share with you" left={<Icon name="clock" color={t.ink} />} onPress={() => setSheet({ type: 'findTime', uids: chat.members.filter((u) => u !== me), flockId: chat.id })} last />
          <T kind="tiny" style={{ marginTop: 16, marginBottom: 6 }}>People</T>
          {chat.members.map((u, i) => (
            <Row key={u} title={u === me ? 'You' : chat.memberCards?.[u]?.name || 'Member'} meta={(chat.admins || []).includes(u) ? 'Admin' : null} left={<Avatar config={chat.memberCards?.[u]?.avatar} size={36} />} last={i === chat.members.length - 1}
              right={admin && u !== me ? (
                <Pressable onPress={() => Alert.alert('Remove from flock?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => run(() => api.removeFlockMember({ chatId: chat.id, uid: u }), 'Removed') }])} hitSlop={8}>
                  <T kind="hand" color={t.redPen}>remove</T>
                </Pressable>
              ) : null} />
          ))}
          {admin ? (
            <>
              {adding ? (
                <View style={{ marginTop: 10 }}>
                  {addable.length ? addable.map((f) => <Row key={f.uid} title={f.name} left={<Avatar config={f.avatar} size={32} />} onPress={() => run(() => api.addFlockMembers({ chatId: chat.id, members: [f.uid] }), `Added ${first(f.name)}`)} />) : <T kind="small">All your friends are already here.</T>}
                </View>
              ) : <Button title="Add friends" icon="userPlus" small kind="ghost" disabled={chat.members.length >= FLOCK_MAX} onPress={() => setAdding(true)} style={{ marginTop: 10, alignSelf: 'flex-start' }} />}
              <Divider />
              <Field label="Flock name" value={name} onChangeText={setName} maxLength={40} />
              <Button title="Rename" small kind="ghost" disabled={name.trim().length < 2 || name === chat.name} onPress={() => run(() => api.renameFlock({ chatId: chat.id, name }), 'Renamed')} style={{ alignSelf: 'flex-start' }} />
            </>
          ) : null}
          <Divider />
          <Row title="Leave flock" left={<Icon name="logout" color={t.redPen} />} onPress={() => Alert.alert('Leave this flock?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: () => run(() => api.leaveFlock({ chatId: chat.id }).then(onClose), 'You left') }])} />
          {admin ? <Row title="Delete flock for everyone" left={<Icon name="trash" color={t.redPen} />} onPress={() => Alert.alert('Delete this flock?', 'All messages and photos are deleted for everyone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => run(() => api.deleteFlock({ chatId: chat.id }).then(onClose), 'Flock deleted') }])} last /> : null}
        </>
      ) : (
        <>
          <Row title="See their profile" left={<Icon name="you" color={t.ink} />} onPress={() => setSheet({ type: 'friend', uid: other })} />
          <Row title="Report" left={<Icon name="report" color={t.redPen} />} onPress={() => run(() => api.reportContent({ uid: other, reason: 'Reported from chat', kind: 'user' }), 'Reported — thanks')} />
          <Row title="Block" left={<Icon name="close" color={t.redPen} />} onPress={() => Alert.alert('Block?', "They won't be able to find, add, or message you. They aren't told.", [{ text: 'Cancel', style: 'cancel' }, { text: 'Block', style: 'destructive', onPress: () => run(() => api.blockUser({ uid: other }).then(onClose), 'Blocked') }])} last />
        </>
      )}
    </Sheet>
  );
}

/* ---------- New flock ---------- */
export function NewFlockSheet({ onClose }) {
  const { friends, showToast, setSheet } = useApp();
  const [name, setName] = useState('');
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const toggle = (u) => setPicked((p) => (p.includes(u) ? p.filter((x) => x !== u) : p.length + 1 >= FLOCK_MAX ? p : [...p, u]));
  const create = async () => {
    setBusy(true);
    try { const r = await api.createFlock({ name, members: picked }); showToast('Flock started'); setSheet({ type: 'chat', chatId: r.data.chatId }); } catch (e) { showToast(errText(e)); }
    setBusy(false);
  };
  return (
    <Sheet title="New flock" hand={`A small group chat with friends — up to ${FLOCK_MAX} people.`} onClose={onClose} height={0.9}
      footer={<Button title="Start flock" icon="check" loading={busy} disabled={name.trim().length < 2 || !picked.length} onPress={create} />}>
      <Field label="Name" placeholder="Library Crew" value={name} onChangeText={setName} maxLength={40} />
      <T kind="tiny" style={{ marginBottom: 6 }}>Friends ({picked.length + 1}/{FLOCK_MAX})</T>
      {friends.length ? friends.map((f, i) => (
        <Row key={f.uid} title={f.name} left={<Avatar config={f.avatar} size={36} />} onPress={() => toggle(f.uid)} chevron={false} last={i === friends.length - 1}
          right={<Icon name={picked.includes(f.uid) ? 'check' : 'plus'} color={picked.includes(f.uid) ? '#2E8256' : '#7D786B'} />} />
      )) : <Empty icon="users" title="Add friends first" />}
      <T kind="small" style={{ marginTop: 10 }}>Only your friends can be added. Anyone can leave a flock any time, and the admin can remove people.</T>
    </Sheet>
  );
}

/* ---------- Send a card to a chat ---------- */
export function ShareCardSheet({ card, onClose }) {
  const { chats, user, showToast, friends, setSheet } = useApp();
  const me = user?.uid;
  const [busy, setBusy] = useState(null);
  const sendTo = async (target) => {
    setBusy(target.key);
    try {
      const chatId = target.chatId || (await api.openDm({ uid: target.uid })).data.chatId;
      await api.sendMessage({ chatId, card });
      showToast('Sent');
      onClose();
    } catch (e) { showToast(errText(e)); }
    setBusy(null);
  };
  if (!user || user.isAnonymous) { setTimeout(() => setSheet({ type: 'account' }), 0); return null; }
  const dmWith = new Set(chats.filter((c) => c.type === 'dm').flatMap((c) => c.members));
  const targets = [
    ...chats.map((c) => ({ key: c.id, chatId: c.id, title: chatTitle(c, me), sub: c.type === 'flock' ? 'Flock' : 'Friend' })),
    ...friends.filter((f) => !dmWith.has(f.uid)).map((f) => ({ key: f.uid, uid: f.uid, title: f.name, sub: 'Friend' })),
  ];
  return (
    <Sheet title="Send to…" hand={card.title || card.name || 'Card'} onClose={onClose} height={0.8}>
      {targets.length ? targets.map((x, i) => <Row key={x.key} title={x.title} meta={x.sub} right={busy === x.key ? <ActivityIndicator /> : null} onPress={() => sendTo(x)} last={i === targets.length - 1} />)
        : <Empty icon="users" title="Add friends first" />}
    </Sheet>
  );
}

/* ---------- Flock board ---------- */
export function FlockBoardSheet({ flockId, onClose }) {
  const { t } = useTheme();
  const [s, setS] = useState({ loading: true, board: [] });
  useEffect(() => { api.getFlightBoard({ flockId }).then((r) => setS({ loading: false, board: r.data.board })).catch((e) => setS({ loading: false, board: [], error: errText(e) })); }, [flockId]);
  return (
    <Sheet title="Flock board" hand="Only people who show their score appear." onClose={onClose} height={0.75}>
      {s.loading ? <Loading /> : s.error ? <T kind="small">{s.error}</T> : s.board.map((r, i) => (
        <Row key={r.uid} title={`${i + 1}. ${r.me ? 'You' : r.name}`} meta={r.title} left={<Avatar config={r.avatar} size={36} />} right={<T kind="num" color={r.me ? t.accent : t.ink}>{r.score}</T>} last={i === s.board.length - 1} />
      ))}
    </Sheet>
  );
}
