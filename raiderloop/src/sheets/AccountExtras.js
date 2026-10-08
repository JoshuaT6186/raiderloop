/**
 * Account deletion and username.
 */
import React, { useState } from 'react';
import { View, Linking, Share } from 'react-native';
import { Sheet, T, PostIt, PT, Button, Field, Row } from '../ui/Paper';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import {
  api, errText, deleteMyAccount, signOut, isAppleUser, revokeApple,
} from '../lib/firebase';
import { AppleAuth, Crypto } from '../lib/native';
import { unregisterPush } from '../lib/push';
import { stopNearby } from '../lib/nearby';

/* ---------- Delete account ---------- */
const DELETES = [
  'Your profile, avatar, and friend code',
  'Friends, requests, and blocks',
  'Flocks you\'re in (you leave), DMs, and messages you sent',
  'Photos you sent',
  'Shared location, shared schedule, and nearby alerts',
  'Flight score, stamps, and your ratings',
  'Meetups you made',
  'Your sign-in (email or Apple)',
  'Everything Flyer saved on this phone',
];

export function DeleteAccountSheet({ onClose }) {
  const { t } = useTheme();
  const app = useApp();
  const { isPlus, resetAll, showToast } = app;
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(null);

  const download = async () => {
    setBusy('export');
    try {
      const r = await api.exportMyData({});
      const local = {
        planner: { classes: app.scheduleItems, assignments: app.assignments, grades: app.gradeCourses },
        settings: { theme: app.theme, notifications: app.notif, interests: app.interests, major: app.userMajor, classYear: app.userClassYear },
        saved: { events: app.savedEvents.map((e) => e.title), orgs: app.followedOrgIds },
      };
      const json = `{"server": ${r.data.json},\n"thisPhone": ${JSON.stringify(local, null, 2)}}`;
      await Share.share({ message: json, title: 'My Flyer data' });
    } catch (e) { showToast(errText(e, "Couldn't get your data. Try again.")); }
    setBusy(null);
  };

  const doDelete = async () => {
    setBusy('delete');
    try {
      if (isAppleUser() && AppleAuth && Crypto) {
        // Apple requires revoking the Sign in with Apple token.
        await revokeApple(AppleAuth, Crypto).catch(() => {});
      }
      await unregisterPush().catch(() => {});
      await deleteMyAccount();
      await stopNearby().catch(() => {});
      await signOut().catch(() => {});
      resetAll();
      showToast('Your account was deleted');
    } catch (e) {
      showToast(errText(e, "Couldn't delete your account. Check your connection and try again."));
      setBusy(null);
    }
  };

  return (
    <Sheet title="Delete account" hand="This can't be undone." onClose={onClose} height={0.94}
      footer={(
        <View>
          <Button title="Delete my account for good" kind="danger" icon="trash" loading={busy === 'delete'} disabled={typed.trim().toUpperCase() !== 'DELETE' || !!busy} onPress={doDelete} />
          <Button title="Keep my account" kind="ghost" onPress={onClose} style={{ marginTop: 10 }} />
        </View>
      )}>
      <T kind="tiny" style={{ marginBottom: 6 }}>What gets deleted</T>
      {DELETES.map((d) => (
        <View key={d} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 4 }}>
          <Icon name="close" size={16} color={t.redPen} style={{ marginTop: 2 }} />
          <T style={{ marginLeft: 8, flex: 1 }}>{d}</T>
        </View>
      ))}
      <PostIt color="yellow" tilt={-0.8} style={{ marginTop: 14 }}>
        <PT kind="bold">{isPlus ? 'You have Flyer Plus' : 'Flyer Plus is separate'}</PT>
        <PT kind="small" style={{ marginTop: 4 }}>Deleting your account does not cancel a subscription. Apple bills it. Cancel it in your Apple ID settings so you aren't charged.</PT>
        <Button title="Open subscriptions" small kind="ghost" onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions').catch(() => {})} style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#fff' }} />
      </PostIt>
      <Row title="Download my data first" meta="Everything Flyer has about you, as text you can save" left={<Icon name="share" color={t.ink} />} onPress={download} right={busy === 'export' ? <T kind="small">…</T> : null} last />
      <Field label="Type DELETE to confirm" placeholder="DELETE" value={typed} onChangeText={setTyped} autoCapitalize="characters" style={{ marginTop: 14 }} />
      {isAppleUser() ? <T kind="small">Since you use Sign in with Apple, Apple will ask you to confirm once more so Flyer's access can be revoked.</T> : null}
    </Sheet>
  );
}

/* ---------- Choose your @username ----------
   People add you by typing it exactly — there's no searchable list of
   students, so a username can't be used to browse who's on Flyer. */
export function localHandleError(raw) {
  const h = String(raw || '').trim().toLowerCase().replace(/^@/, '');
  if (!h) return null;
  if (!/^[a-z0-9_]*$/.test(h)) return 'Use only letters, numbers and underscores.';
  if (h.length > 20) return 'Usernames are 3 to 20 characters.';
  if (/^_|__/.test(h)) return "Underscores can't be at the start or doubled.";
  return null;
}

export function HandleSheet({ onClose }) {
  const { t } = useTheme();
  const { profile, showToast } = useApp();
  const [value, setValue] = useState(profile?.handle || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const h = value.trim().toLowerCase().replace(/^@/, '');
  const local = localHandleError(h);
  const unchanged = h === (profile?.handle || '');
  const save = async () => {
    setBusy(true); setError(null);
    try { const r = await api.setHandle({ handle: h }); showToast(`You're @${r.data.handle}`); onClose(); } catch (e) { setError(errText(e, "Couldn't save that username.")); }
    setBusy(false);
  };
  return (
    <Sheet title="Your username" hand="Friends type this to add you." onClose={onClose} height={0.7}
      footer={<Button title="Save" icon="check" loading={busy} disabled={unchanged || h.length < 3 || !!local} onPress={save} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <T kind="marker" style={{ fontSize: 26, marginRight: 6, marginBottom: 14 }}>@</T>
        <Field value={h} onChangeText={(v) => { setValue(v); setError(null); }} placeholder="yourname" autoCapitalize="none" autoCorrect={false}
          maxLength={21} autoFocus style={{ flex: 1 }} returnKeyType="done" onSubmitEditing={() => { if (!unchanged && h.length >= 3 && !local) save(); }} />
      </View>
      {local || error ? <T kind="small" color={t.redPen} style={{ marginTop: -6, marginBottom: 10 }}>{local || error}</T> : null}
      <T kind="small">3 to 20 letters, numbers or underscores. People can only find you by typing your exact username. Flyer doesn't have a list of students to browse.</T>
      <T kind="small" color={t.pencil} style={{ marginTop: 8 }}>If you change it, your old username stops working and someone else can take it.</T>
    </Sheet>
  );
}
