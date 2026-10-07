/**
 * Add friends in person with a QR code.
 * ------------------------------------------------------------
 * Your code refreshes every 5 minutes, so a screenshot posted online
 * stops working. Scanning someone's code makes you friends right
 * away (showing it is their yes; scanning it is yours). New friends
 * see nothing of your schedule or location until you share it.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Sheet, T, PostIt, PT, Button, Loading } from '../ui/Paper';
import Avatar from '../ui/Avatar';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { Camera, QRCode } from '../lib/native';
import { api, errText } from '../lib/firebase';
import { shareText } from '../lib/links';

export function parseFriendCode(s) {
  const m = String(s || '').match(/(?:flyer:\/\/add\/)?([A-Z0-9]{6,12})\s*$/i);
  return m ? m[1].toUpperCase() : null;
}

export async function redeemCode(code, showToast) {
  try {
    const r = await api.redeemFriendCode({ code });
    showToast(r.data.already ? `You and ${r.data.name || 'them'} are already friends` : `You and ${(r.data.name || 'your new friend').split(' ')[0]} are friends!`);
    return true;
  } catch (e) { showToast(errText(e, "That code didn't work.")); return false; }
}

function MyCode() {
  const { t } = useTheme();
  const { avatar, userName, showToast } = useApp();
  const [code, setCode] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [err, setErr] = useState(null);
  const making = useRef(false);
  const make = useCallback(async () => {
    if (making.current) return;
    making.current = true;
    setErr(null);
    // Count down from when the code arrived (the phone's clock may be off).
    try { const r = await api.createFriendCode({ kind: 'qr' }); setCode({ ...r.data, expiresAt: Date.now() + (r.data.ttlMs || 300000) - 5000 }); } catch (e) { setErr(errText(e)); }
    making.current = false;
  }, []);
  useEffect(() => { make(); }, [make]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { if (code && !err && now > code.expiresAt) make(); }, [now, code, err, make]);
  const left = code ? Math.max(0, Math.round((code.expiresAt - now) / 1000)) : 0;
  const invite = async () => {
    try {
      const r = await api.createFriendCode({ kind: 'link' });
      shareText(`Add me on Flyer: open this on your phone → ${r.data.url}\n(or in Flyer: Friends → Add → enter ${r.data.code}). Works for 24 hours.`);
    } catch (e) { showToast(errText(e)); }
  };
  const reset = async () => {
    try { await api.resetFriendCodes({}); await make(); showToast('Old codes and links stopped working'); } catch (e) { showToast(errText(e)); }
  };
  return (
    <View>
      <PostIt color="yellow" tilt={-0.6} tape padding={18}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Avatar config={avatar} size={44} />
          <PT kind="title" style={{ marginLeft: 10 }}>{userName || 'You'}</PT>
        </View>
        <View style={{ alignItems: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 8, borderWidth: 2, borderColor: '#1F2A44', alignSelf: 'center' }}>
          {err ? <PT kind="small">{err}</PT> : !code ? <Loading label="Making your code…" /> : QRCode ? (
            <QRCode value={code.url} size={210} color="#1F2A44" backgroundColor="#FFFFFF" />
          ) : <PT kind="title">{code.code}</PT>}
        </View>
        {code ? <PT kind="bold" style={{ textAlign: 'center', marginTop: 10 }}>Code {code.code} · new code in {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</PT> : null}
      </PostIt>
      <View style={{ flexDirection: 'row', marginTop: 14 }}>
        <Button title="Send invite link" icon="share" small kind="ghost" onPress={invite} style={{ flex: 1, marginRight: 8 }} />
        <Button title="Reset my code" icon="refresh" small kind="ghost" onPress={reset} style={{ flex: 1 }} />
      </View>
      <T kind="small" style={{ marginTop: 12 }}>Codes refresh every few minutes and invite links last 24 hours, so a screenshot posted online stops working. New friends can't see your schedule or location until you choose to share it.</T>
      <T kind="small" color={t.pencil} style={{ marginTop: 6 }}>Their iPhone camera can scan this too — it opens Flyer and adds you.</T>
    </View>
  );
}

function Scanner({ onDone }) {
  const { showToast } = useApp();
  const [perm, setPerm] = useState(null);
  const busy = useRef(false);
  useEffect(() => {
    if (!Camera) return;
    Camera.Camera.requestCameraPermissionsAsync().then((p) => setPerm(!!p.granted)).catch(() => setPerm(false));
  }, []);
  if (!Camera) return <PostIt color="yellow"><PT kind="bold">Scanning needs the full app build.</PT><PT kind="small">You can still type their code in Friends → Add.</PT></PostIt>;
  if (perm === null) return <Loading label="Opening the camera…" />;
  if (!perm) return <PostIt color="yellow"><PT kind="bold">Camera is off for Flyer.</PT><PT kind="small">Turn it on in Settings → Flyer → Camera, or type their code instead.</PT></PostIt>;
  const { CameraView } = Camera;
  return (
    <View style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: '#1F2A44', height: 340 }}>
      <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={async ({ data }) => {
          if (busy.current) return;
          const code = parseFriendCode(data);
          if (!code) return;
          busy.current = true;
          const ok = await redeemCode(code, showToast);
          if (ok) onDone(); else setTimeout(() => { busy.current = false; }, 2500);
        }} />
    </View>
  );
}

export default function QrFriendSheet({ initialTab = 'mine', onClose }) {
  const { t } = useTheme();
  const { user, setSheet } = useApp();
  const [tab, setTab] = useState(initialTab);
  if (!user || user.isAnonymous) { setTimeout(() => setSheet({ type: 'account' }), 0); return null; }
  return (
    <Sheet title="Add a friend" hand="Scan in person — no searching." onClose={onClose} height={0.94}>
      <View style={{ flexDirection: 'row', borderWidth: 2, borderColor: '#1F2A44', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
        {[['mine', 'My code'], ['scan', 'Scan']].map(([id, label]) => (
          <Pressable key={id} onPress={() => setTab(id)} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: tab === id ? '#1F2A44' : t.card }} accessibilityRole="tab" accessibilityState={{ selected: tab === id }}>
            <T kind="bold" color={tab === id ? '#FFFFFF' : t.ink}>{label}</T>
          </Pressable>
        ))}
      </View>
      {tab === 'mine' ? <MyCode /> : <Scanner onDone={onClose} />}
    </Sheet>
  );
}
