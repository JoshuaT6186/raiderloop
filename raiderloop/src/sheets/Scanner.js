/**
 * One QR scanner for everything Flyer prints: Connect cards, Flyer
 * Drops, group invites, plans, office hours lines, TV codes, and hide
 * and seek tags. It reads the code and hands it to the right screen.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Linking } from 'react-native';
import { Sheet, T, PostIt, PT, Button, Field } from '../ui/Paper';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme/ThemeContext';
import { Camera, tap } from '../lib/native';
import { parseLink } from '../lib/deeplinks';

async function askCamera() {
  const C = Camera && (Camera.Camera || Camera);
  const req = C && (C.requestCameraPermissionsAsync || Camera.requestCameraPermissionsAsync);
  if (!req) return false;
  const r = await req();
  return !!(r && r.granted);
}

/** onCode(text) returns true when it handled the code (closes the scanner). */
export function ScannerSheet({ title = 'Scan a QR code', hand = 'Point your camera at a Flyer QR code.', onCode, onClose, allowTyping = true }) {
  const { t } = useTheme();
  const { routeLink, showToast } = useApp();
  const [perm, setPerm] = useState(null);
  const [typed, setTyped] = useState('');
  const busy = useRef(false);
  useEffect(() => { askCamera().then(setPerm).catch(() => setPerm(false)); }, []);
  const handle = async (text) => {
    if (busy.current || !text) return;
    busy.current = true;
    tap('success');
    try {
      const done = onCode ? await onCode(text) : false;
      if (done) { onClose(); return; }
      const link = parseLink(text);
      if (link) { onClose(); setTimeout(() => routeLink(link), 250); return; }
      if (/^https?:\/\//.test(text)) { onClose(); Linking.openURL(text).catch(() => {}); return; }
      showToast("That QR code isn't from Flyer.");
    } finally { setTimeout(() => { busy.current = false; }, 1200); }
  };
  const CameraView = Camera && Camera.CameraView;
  return (
    <Sheet title={title} hand={hand} onClose={onClose} height={0.9} scroll={false}>
      {CameraView && perm ? (
        <View style={{ height: 340, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: '#1F2A44', backgroundColor: '#000' }}>
          <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => handle(data)} />
          <View pointerEvents="none" style={{ position: 'absolute', left: '18%', right: '18%', top: '16%', bottom: '16%', borderWidth: 3, borderColor: '#FFE45C', borderRadius: 18 }} />
        </View>
      ) : (
        <PostIt color="yellow" tilt={-1}>
          <PT kind="bold">{!CameraView ? "The camera isn't in this build." : perm === false ? 'Camera access is off for Flyer.' : 'Starting the camera…'}</PT>
          {perm === false ? <PT kind="small" style={{ marginTop: 4 }}>Turn it on in Settings → Flyer → Camera, or type the code below.</PT> : null}
          {perm === false ? <Button title="Open Settings" small kind="ghost" onPress={() => Linking.openSettings().catch(() => {})} style={{ marginTop: 10, backgroundColor: '#fff' }} /> : null}
        </PostIt>
      )}
      {allowTyping ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 14 }}>
          <Field placeholder="Or type a code or link" value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} style={{ flex: 1, marginRight: 8 }} />
          <Button title="Go" small disabled={typed.trim().length < 4} onPress={() => handle(typed.trim())} style={{ marginTop: 2 }} />
        </View>
      ) : null}
      <T kind="small" color={t.pencil}>Flyer only opens codes it made. Anything else opens in your browser.</T>
    </Sheet>
  );
}
