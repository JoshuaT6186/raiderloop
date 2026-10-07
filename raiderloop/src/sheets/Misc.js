/**
 * Smaller sheets: Gameday, Flyer Plus, account upgrade for guests.
 */
import React, { useEffect, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Sheet, T, PostIt, PT, Button, Row, Field, Loading } from '../ui/Paper';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { FOOTBALL_SCHEDULE, gameDateLabel, buildingById, RESOURCES } from '../data/campus';
import { openUrl, openDirections } from '../lib/links';
import { expiryFor, getForegroundPermission, sharingActive } from '../lib/location';
import { emailSignUp, appleSignIn } from '../lib/firebase';
import { AppleAuth, Crypto } from '../lib/native';
import { getPlusOffering, buyPlus, restorePlus, purchasesAvailable } from '../lib/monetize';
import { LIMITS, PURCHASES } from '../config';

/* ---------- Gameday ---------- */
export function GamedaySheet({ kickoff, onClose }) {
  const { t } = useTheme();
  const { friends, sharing, set, showToast, user, setSheet } = useApp();
  const g = FOOTBALL_SCHEDULE.find((x) => x.kickoff === kickoff);
  const [picked, setPicked] = useState(() => sharing.allowed.length ? sharing.allowed : friends.map((f) => f.uid));
  if (!g) return null;
  const home = g.homeAway === 'home';
  const stadium = g.buildingId ? buildingById(g.buildingId) : null;
  const toggle = (uid) => setPicked((p) => (p.includes(uid) ? p.filter((x) => x !== uid) : [...p, uid]));
  const startGameShare = async () => {
    if (!(await getForegroundPermission(true))) { showToast('Turn on location for Flyer in Settings to share.'); return; }
    set((p) => ({ sharing: { ...p.sharing, on: true, allowed: picked, until: expiryFor('game'), campusOnly: false } }));
    showToast('Sharing with your crew for the next 5 hours');
    onClose();
  };
  return (
    <Sheet title={`${home ? 'vs.' : 'at'} ${g.opponent}`} hand={`${gameDateLabel(g.kickoff)} · ${g.venue}`} onClose={onClose}>
      <View>
        {stadium ? <Row title="Walking directions to the stadium" left={<Icon name="walk" color={t.ink} />} onPress={() => openDirections(stadium)} /> : null}
        {RESOURCES.filter((r) => ['res5', 'res7'].includes(r.id)).map((r) => <Row key={r.id} title={r.name} meta={r.kind} left={<Icon name="link" color={t.ink} />} onPress={() => openUrl(r.url)} />)}
      </View>
      {home ? (
        <PostIt color="orange" tilt={-1} tape style={{ marginTop: 18 }}>
          <PT kind="title">Find each other in the stands</PT>
          <PT kind="small" style={{ marginTop: 4 }}>Share your spot with the friends you pick, for 5 hours. Turns itself off after the game.</PT>
          {user && !user.isAnonymous ? (
            friends.length ? (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
                  {friends.map((f) => (
                    <Pressable key={f.uid} onPress={() => toggle(f.uid)} style={{ alignItems: 'center', marginRight: 12, marginBottom: 8, opacity: picked.includes(f.uid) ? 1 : 0.4 }} accessibilityLabel={f.name}>
                      <Avatar config={f.avatar} size={44} />
                      <PT kind="small" style={{ fontSize: 11 }}>{(f.name || '').split(' ')[0]}</PT>
                    </Pressable>
                  ))}
                </View>
                <Button title={sharingActive(sharing) ? 'Update game sharing' : 'Share for the game'} icon="location" disabled={!picked.length} onPress={startGameShare} style={{ marginTop: 8 }} />
              </>
            ) : <Button title="Add friends first" kind="ghost" small onPress={() => setSheet({ type: 'friends' })} style={{ marginTop: 10, backgroundColor: '#fff' }} />
          ) : <Button title="Make an account to share" kind="ghost" small onPress={() => setSheet({ type: 'account' })} style={{ marginTop: 10, backgroundColor: '#fff' }} />}
        </PostIt>
      ) : null}
    </Sheet>
  );
}

/* ---------- Flyer Plus ---------- */
export function PlusSheet({ onClose }) {
  const { t } = useTheme();
  const { set, showToast } = useApp();
  const [offering, setOffering] = useState(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => { getPlusOffering().then(setOffering); }, []);
  const pkg = offering?.monthly || offering?.availablePackages?.[0];
  const perks = [
    ['tag', 'No ads, anywhere'],
    ['plane', `${LIMITS.pilotPlus} Pilot questions a day (instead of ${LIMITS.pilotFree})`],
    ['star', 'Extra avatar gear — grad cap, jersey'],
    ['heart', 'Keeps a student-built app running'],
  ];
  return (
    <Sheet title="Flyer Plus" hand="Everything stays free. Plus is a thank-you with perks." onClose={onClose}
      footer={(
        <View>
          {!purchasesAvailable() ? <T kind="small" style={{ marginBottom: 8 }}>Purchases aren't set up in this build yet.</T> : null}
          <Button title={pkg ? `Get Plus · ${pkg.product.priceString}/mo` : `Get Plus · ${PURCHASES.priceHint}`} icon="crown" kind="highlight" loading={busy} disabled={!pkg}
            onPress={async () => { setBusy(true); try { if (await buyPlus(pkg)) { set({ isPlus: true }); showToast('Welcome to Plus!'); onClose(); } } catch (e) { if (!e.userCancelled) showToast(e.message); } setBusy(false); }} />
          <Pressable onPress={async () => { try { const ok = await restorePlus(); set({ isPlus: ok }); showToast(ok ? 'Plus restored' : 'No purchase found'); } catch (e) { showToast(e.message); } }} style={{ alignItems: 'center', marginTop: 12 }}>
            <T kind="hand" color={t.pencil}>restore purchase</T>
          </Pressable>
          <T kind="small" style={{ fontSize: 11, textAlign: 'center', marginTop: 6 }}>Renews monthly until canceled in your App Store settings.</T>
        </View>
      )}>
      {offering === undefined ? <Loading /> : null}
      <PostIt color="yellow" tilt={-1.2} tape padding={18}>
        {perks.map(([icon, label]) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
            <Icon name={icon} color="#1F2A44" size={20} /><PT kind="bold" style={{ marginLeft: 10, flex: 1 }}>{label}</PT>
          </View>
        ))}
      </PostIt>
    </Sheet>
  );
}

/* ---------- Guest → account ---------- */
export function AccountSheet({ onClose }) {
  const { t } = useTheme();
  const { userName, set, showToast } = useApp();
  const [name, setName] = useState(userName);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const create = async () => {
    setBusy(true); setError(null);
    try { await emailSignUp(email.trim(), password, name.trim()); set({ userName: name.trim() }); showToast('Account created'); onClose(); } catch (e) { setError(e.message); }
    setBusy(false);
  };
  return (
    <Sheet title="Make your account" hand="Everything you've set up comes with you." onClose={onClose}
      footer={<Button title="Create account" icon="check" loading={busy} disabled={!email || password.length < 6 || !name.trim()} onPress={create} />}>
      {AppleAuth ? <Button title="Continue with Apple" icon="lock" kind="ghost" onPress={async () => { try { await appleSignIn(AppleAuth, Crypto); showToast('Signed in'); onClose(); } catch (e) { if (!/cancel/i.test(e.code || '')) setError(e.message); } }} style={{ marginBottom: 14 }} /> : null}
      <Field label="First name" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="6+ characters" />
      {error ? <T kind="small" color={t.redPen}>{error}</T> : null}
    </Sheet>
  );
}
