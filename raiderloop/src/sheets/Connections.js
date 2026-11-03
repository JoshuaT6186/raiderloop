/**
 * Connections: calendar links, Microsoft, Google, Canva, Apple Health,
 * Text Flyer, and (tucked away under Advanced) a Canvas access token.
 * Each one says what it reads, and everything can be removed.
 */
import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import {
  Sheet, T, PostIt, PT, Card, Button, Row, Field, Loading, Divider,
} from '../ui/Paper';
import { SectionNote, Pill } from '../ui/Kit';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api } from '../lib/firebase';
import {
  addFeed, syncFeed, deleteSecret, setCanvasToken, syncCanvasToken, providerReady, connectProvider, disconnectProvider,
  oneDriveRecent, providerEvents, canvaReady, connectCanva, canvaDesigns,
} from '../lib/connectors';
import { healthAvailable } from '../lib/health';
import { CONNECTORS } from '../config';

function Status({ on }) {
  return <Pill label={on ? 'Connected' : 'Not connected'} color={on ? 'green' : undefined} icon={on ? 'check' : undefined} />;
}

/* Pick a OneDrive file or Canva design to clip into a group. */
function Picker({ pick, onDone }) {
  const { t } = useTheme();
  const { showToast } = useApp();
  const [items, setItems] = useState(null);
  useEffect(() => {
    (pick.kind === 'canva' ? canvaDesigns() : oneDriveRecent()).then(setItems).catch((e) => { setItems([]); showToast(e.message); });
  }, [pick.kind]);
  const clip = async (it) => {
    try { await api.groupAction({ id: pick.groupId, op: 'addFile', url: it.url, title: it.title, kind: pick.kind === 'canva' ? 'Canva' : it.kind }); showToast('Clipped to the group'); onDone(); } catch (e) { showToast(e.message); }
  };
  if (!items) return <Loading label={pick.kind === 'canva' ? 'Loading your Canva designs…' : 'Loading your OneDrive files…'} />;
  if (!items.length) return <T kind="small">Nothing found.</T>;
  return <Card>{items.map((it, i) => <Row key={it.id} title={it.title} meta={it.kind || 'Canva design'} left={<Icon name={pick.kind === 'canva' ? 'palette' : 'folder'} color={t.ink} />} onPress={() => clip(it)} last={i === items.length - 1} />)}</Card>;
}

export function ConnectionsSheet({ pick, onClose }) {
  const { t } = useTheme();
  const app = useApp();
  const { feeds, connections, set, showToast, mergeFeed, removeFeedData, mergeCanvasAssignments, setSheet, user, schoolId } = app;
  const [adding, setAdding] = useState(false);
  const [feedName, setFeedName] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [busy, setBusy] = useState(null);
  const [advanced, setAdvanced] = useState(false);
  const [token, setToken] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [smsStep, setSmsStep] = useState('phone');
  const conn = (patch) => set((p) => ({ connections: { ...p.connections, ...patch } }));
  const signedIn = user && !user.isAnonymous;

  if (pick) return <Sheet title={pick.kind === 'canva' ? 'Clip from Canva' : 'Clip from OneDrive'} onClose={onClose}><Picker pick={pick} onDone={onClose} /></Sheet>;

  const add = async () => {
    setBusy('feed');
    try {
      const { feed, data } = await addFeed({ name: feedName, url: feedUrl });
      set((p) => ({ feeds: [...p.feeds, feed] }));
      mergeFeed(feed.id, data.assignments, data.events);
      showToast(`Added ${data.assignments.length} due dates and ${data.events.length} events`);
      setAdding(false); setFeedName(''); setFeedUrl('');
    } catch (e) { showToast(e.message); }
    setBusy(null);
  };
  const sync = async (f) => {
    setBusy(f.id);
    try { const data = await syncFeed(f); mergeFeed(f.id, data.assignments, data.events); set((p) => ({ feeds: p.feeds.map((x) => (x.id === f.id ? { ...x, lastSync: new Date().toISOString(), count: data.assignments.length + data.events.length } : x)) })); showToast('Synced'); } catch (e) { showToast(e.message); }
    setBusy(null);
  };
  const removeFeed = async (f) => { await deleteSecret(`flyer.feed.${f.id}`); removeFeedData(f.id); set((p) => ({ feeds: p.feeds.filter((x) => x.id !== f.id) })); showToast('Removed'); };
  const provider = async (p) => {
    setBusy(p);
    try {
      if (connections[p]) { await disconnectProvider(p); removeFeedData(`oauth-${p}`); conn({ [p]: false }); showToast('Disconnected'); } else {
        await connectProvider(p); conn({ [p]: true });
        const events = await providerEvents(p).catch(() => []);
        mergeFeed(`oauth-${p}`, [], events);
        showToast(`Connected. ${events.length} upcoming events added.`);
      }
    } catch (e) { showToast(e.message); }
    setBusy(null);
  };
  const canva = async () => {
    setBusy('canva');
    try { if (connections.canva) { await api.canvaDisconnect({}); conn({ canva: false }); } else { await connectCanva(); conn({ canva: true }); showToast('Canva connected'); } } catch (e) { showToast(e.message); }
    setBusy(null);
  };
  const saveToken = async () => {
    setBusy('token');
    try { const who = await setCanvasToken(token, schoolId); conn({ canvasToken: true }); setToken(''); const r = await syncCanvasToken(schoolId); mergeCanvasAssignments(r.assignments); set({ canvasCourses: r.courses }); showToast(`Canvas connected for ${who}`); } catch (e) { showToast(e.message); }
    setBusy(null);
  };
  const sms = async () => {
    setBusy('sms');
    try {
      if (smsStep === 'phone') { await api.smsStart({ phone }); setSmsStep('code'); showToast('Code sent'); } else { await api.smsConfirm({ code }); conn({ textFlyer: true }); setSmsStep('done'); showToast('Text Flyer is on'); }
    } catch (e) { showToast(e.code === 'functions/not-found' ? "Text Flyer isn't switched on yet." : e.message); }
    setBusy(null);
  };
  return (
    <Sheet title="Connections" hand="Bring your stuff into Flyer. Everything is read-only and removable." onClose={onClose} height={0.95}>
      <T kind="tiny" style={{ marginBottom: 6 }}>Calendar links</T>
      <Card>
        {feeds.map((f) => (
          <Row key={f.id} title={f.name} meta={`${f.count} items · synced ${new Date(f.lastSync).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`} left={<Icon name="calendarPlus" color={t.ink} />}
            right={(
              <View style={{ flexDirection: 'row' }}>
                <Pressable onPress={() => sync(f)} hitSlop={8} style={{ marginRight: 14 }} accessibilityLabel="Sync">{busy === f.id ? <Loading label="" /> : <Icon name="refresh" size={18} color={t.ink} />}</Pressable>
                <Pressable onPress={() => removeFeed(f)} hitSlop={8} accessibilityLabel="Remove"><Icon name="trash" size={18} color={t.redPen} /></Pressable>
              </View>
            )} />
        ))}
        {!adding ? (
          <View>
            {!feeds.length ? <T kind="small" style={{ marginBottom: 8 }}>Canvas due dates, your Outlook or Google calendar, or a club's calendar. They show up in your Planner next to your classes.</T> : null}
            <Button title="Add a calendar link" icon="plus" small kind="ghost" onPress={() => setAdding(true)} style={{ alignSelf: 'flex-start', marginTop: feeds.length ? 8 : 0 }} />
          </View>
        ) : (
          <View style={{ marginTop: 6 }}>
            <PostIt color="blue" tilt={-0.5} style={{ marginBottom: 12 }}>
              <PT kind="bold">Canvas (easiest)</PT>
              <PT kind="small">Canvas → Calendar → "Calendar Feed" at the bottom right → copy the link. Every due date comes with it, and it's read-only.</PT>
              <PT kind="bold" style={{ marginTop: 8 }}>Google or Outlook</PT>
              <PT kind="small">Calendar settings → "Secret address in iCal format" (Google) or "Publish calendar → ICS" (Outlook).</PT>
            </PostIt>
            <Field label="Name" value={feedName} onChangeText={setFeedName} placeholder="Canvas" />
            <Field label="Link" value={feedUrl} onChangeText={setFeedUrl} placeholder="https://… or webcal://…" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
            <View style={{ flexDirection: 'row' }}>
              <Button title="Add" small loading={busy === 'feed'} disabled={feedUrl.trim().length < 12} onPress={add} style={{ marginRight: 8 }} />
              <Button title="Cancel" small kind="ghost" onPress={() => setAdding(false)} />
            </View>
          </View>
        )}
      </Card>
      <SectionNote icon="lock">Calendar links stay in your iPhone Keychain and are only read from this phone.</SectionNote>

      <T kind="tiny" style={{ marginTop: 18, marginBottom: 6 }}>Accounts</T>
      <Card>
        <Row title="Microsoft (OneDrive + Outlook)" meta={providerReady('microsoft') ? 'Clip OneDrive files into groups; see Outlook events' : 'Coming soon in Flyer'} left={<Icon name="folder" color={t.ink} />}
          right={providerReady('microsoft') ? <Button title={connections.microsoft ? 'Disconnect' : 'Connect'} small kind={connections.microsoft ? 'ghost' : 'primary'} loading={busy === 'microsoft'} onPress={() => provider('microsoft')} /> : <Status on={false} />} />
        <Row title="Google Calendar" meta={providerReady('google') ? 'See your Google Calendar events in Flyer' : 'Coming soon in Flyer. A calendar link works today.'} left={<Icon name="calendarPlus" color={t.ink} />}
          right={providerReady('google') ? <Button title={connections.google ? 'Disconnect' : 'Connect'} small kind={connections.google ? 'ghost' : 'primary'} loading={busy === 'google'} onPress={() => provider('google')} /> : <Status on={false} />} />
        <Row title="Canva" meta={canvaReady() ? 'Clip your designs into Group Spaces' : 'Coming soon in Flyer. You can paste Canva links today.'} left={<Icon name="palette" color={t.ink} />}
          right={canvaReady() && signedIn ? <Button title={connections.canva ? 'Disconnect' : 'Connect'} small kind={connections.canva ? 'ghost' : 'primary'} loading={busy === 'canva'} onPress={canva} /> : <Status on={false} />} />
        <Row title="Apple Health" meta={healthAvailable() ? 'Sleep and steps next to your schedule, on this phone only' : 'Not available on this device'} left={<Icon name="heart" color={t.ink} />}
          onPress={() => setSheet({ type: 'wellness' })} right={<Status on={connections.health} />} last />
      </Card>

      <T kind="tiny" style={{ marginTop: 18, marginBottom: 6 }}>Text Flyer</T>
      <Card>
        {CONNECTORS.textFlyerNumber ? (
          connections.textFlyer || smsStep === 'done' ? (
            <>
              <T kind="bold">Text {CONNECTORS.textFlyerNumber} any campus question</T>
              <T kind="small">Like "what's open for food right now?" Pilot texts back. Uses your daily Pilot questions. Reply STOP any time.</T>
              <Button title="Turn off Text Flyer" small kind="ghost" onPress={() => api.smsDisconnect({}).then(() => { conn({ textFlyer: false }); setSmsStep('phone'); }).catch((e) => showToast(e.message))} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
            </>
          ) : signedIn ? (
            <>
              <T kind="small" style={{ marginBottom: 8 }}>Ask Pilot by text message, no app needed. Link your number first.</T>
              {smsStep === 'phone' ? <Field placeholder="Your phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" /> : <Field placeholder="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />}
              <Button title={smsStep === 'phone' ? 'Text me a code' : 'Confirm'} small loading={busy === 'sms'} disabled={smsStep === 'phone' ? phone.replace(/\D/g, '').length < 10 : code.length !== 6} onPress={sms} style={{ alignSelf: 'flex-start' }} />
              <T kind="small" color={t.pencil} style={{ marginTop: 6 }}>Msg and data rates may apply. Your schedule summary is shared with Pilot only while this is on.</T>
            </>
          ) : <T kind="small">Make an account to link a phone number.</T>
        ) : <T kind="small">Coming soon: text Flyer a campus question and Pilot texts back.</T>}
      </Card>

      <Divider />
      <Pressable onPress={() => setAdvanced(!advanced)} style={{ flexDirection: 'row', alignItems: 'center' }} accessibilityRole="button">
        <Icon name={advanced ? 'chevronDown' : 'chevronRight'} size={18} color={t.pencil} />
        <T kind="hand" color={t.pencil} style={{ marginLeft: 6 }}>advanced</T>
      </Pressable>
      {advanced ? (
        <Card style={{ marginTop: 10 }}>
          <T kind="bold">Canvas access token</T>
          <T kind="small" style={{ marginTop: 2 }}>Only if you already use one. The calendar link above is easier and safer. A token can do anything your Canvas account can, so it stays in your iPhone Keychain, Flyer only ever reads with it, and it never leaves this phone.</T>
          {connections.canvasToken ? (
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <Button title="Sync now" icon="refresh" small loading={busy === 'token'} onPress={async () => { setBusy('token'); try { const r = await syncCanvasToken(schoolId); mergeCanvasAssignments(r.assignments); set({ canvasCourses: r.courses }); showToast('Synced'); } catch (e) { showToast(e.message); } setBusy(null); }} style={{ marginRight: 8 }} />
              <Button title="Remove token" small kind="danger" onPress={async () => { await deleteSecret('flyer.canvasToken'); conn({ canvasToken: false }); showToast('Removed'); }} />
            </View>
          ) : (
            <>
              <Field placeholder="Paste token" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} secureTextEntry style={{ marginTop: 10 }} />
              <Button title="Save token" small loading={busy === 'token'} disabled={token.trim().length < 20} onPress={saveToken} style={{ alignSelf: 'flex-start' }} />
            </>
          )}
        </Card>
      ) : null}
      <SectionNote icon="trash">Remove every connection at once in You → Me → What Flyer knows.</SectionNote>
    </Sheet>
  );
}
