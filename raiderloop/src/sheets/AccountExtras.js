/**
 * TTU email verification and account deletion.
 */
import React, { useState } from 'react';
import { View, Linking, Share } from 'react-native';
import { Sheet, T, PostIt, PT, Button, Field, Row } from '../ui/Paper';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import {
  api, errText, startSchoolVerification, refreshSchoolVerification, deleteMyAccount, signOut, isAppleUser, revokeApple, auth,
} from '../lib/firebase';
import { AppleAuth, Crypto } from '../lib/native';
import { unregisterPush } from '../lib/push';
import { stopNearby } from '../lib/nearby';

/* ---------- Verify a TTU email ---------- */
export function VerifySchoolSheet({ onClose }) {
  const { t } = useTheme();
  const { showToast } = useApp();
  const [email, setEmail] = useState(/@ttu\.edu$/i.test(auth.currentUser?.email || '') ? auth.currentUser.email : '');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try { const r = await startSchoolVerification(email); if (r.already) { showToast('Already verified'); onClose(); } else setSent(true); } catch (e) {
      showToast(/recent/i.test(e.code || e.message) ? 'For security, sign out and back in, then try again.' : errText(e, "Couldn't send the email."));
    }
    setBusy(false);
  };
  const check = async () => {
    setBusy(true);
    const r = await refreshSchoolVerification();
    setBusy(false);
    if (r.signedOut) { showToast('Your sign-in email is now your TTU email. Sign in again with it.'); onClose(); return; }
    if (r.verified) {
      showToast('TTU email verified — you can join class lists now');
      onClose();
    } else showToast("Not verified yet — tap the link in the email, then try again.");
  };
  return (
    <Sheet title="Verify your TTU email" hand="Class lists are only for real students." onClose={onClose} height={0.75}
      footer={sent ? <Button title="I tapped the link" icon="check" loading={busy} onPress={check} /> : <Button title="Send verification email" icon="send" loading={busy} disabled={!/^[^@\s]+@ttu\.edu$/i.test(email.trim())} onPress={send} />}>
      <Field label="TTU email" placeholder="you@ttu.edu" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" editable={!sent} />
      {sent ? (
        <PostIt color="green" tilt={-1}>
          <PT kind="bold">Check {email.trim()}</PT>
          <PT kind="small" style={{ marginTop: 4 }}>Tap the link in the email from Flyer (it may be in Junk), then come back and tap "I tapped the link".</PT>
        </PostIt>
      ) : (
        <T kind="small">We'll send a link to your @ttu.edu address. If your Flyer account uses a different email, your TTU email becomes your sign-in email once you tap the link. Nobody else sees it.</T>
      )}
      <T kind="small" color={t.pencil} style={{ marginTop: 10 }}>Verifying proves you're a TTU student. It doesn't prove which classes you're in — the app says that on every class list.</T>
    </Sheet>
  );
}

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
    } catch (e) { showToast(errText(e, "Couldn't get your data — try again.")); }
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
      await stopNearby().catch(() => {});
      await deleteMyAccount();
      await signOut().catch(() => {});
      resetAll();
      showToast('Your account was deleted');
    } catch (e) {
      showToast(errText(e, "Couldn't delete your account — check your connection and try again."));
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
        <PT kind="small" style={{ marginTop: 4 }}>Deleting your account does not cancel a subscription — Apple bills it. Cancel it in your Apple ID settings so you aren't charged.</PT>
        <Button title="Open subscriptions" small kind="ghost" onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions').catch(() => {})} style={{ marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#fff' }} />
      </PostIt>
      <Row title="Download my data first" meta="Everything Flyer has about you, as text you can save" left={<Icon name="share" color={t.ink} />} onPress={download} right={busy === 'export' ? <T kind="small">…</T> : null} last />
      <Field label="Type DELETE to confirm" placeholder="DELETE" value={typed} onChangeText={setTyped} autoCapitalize="characters" style={{ marginTop: 14 }} />
      {isAppleUser() ? <T kind="small">Since you use Sign in with Apple, Apple will ask you to confirm once more so Flyer's access can be revoked.</T> : null}
    </Sheet>
  );
}
