/**
 * Hide and seek, played on campus with friends.
 * Safety first: friends only, inside a play area, up to an hour, and
 * nobody's location is ever shown to other players. Seekers get
 * "hot / warm / cool / cold" hints; a hider is tagged when a seeker
 * scans the code on the hider's phone (so you have to actually find
 * them). Works while Flyer is open.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import {
  Sheet, T, PostIt, PT, Card, Button, Chip, Loading, Empty, Check,
} from '../ui/Paper';
import { QRCode, PersonRow, SectionNote, StampThunk, RubberStamp } from '../ui/Kit';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api, listenDoc } from '../lib/firebase';
import { currentPosition, getForegroundPermission } from '../lib/location';
import { KeepAwake } from '../lib/native';
import { SCHOOLS } from '../config';
import { ScannerSheet } from './Scanner';

const BAND = {
  hot: { label: 'HOT', color: 'pink', note: "You're right on top of someone." },
  warm: { label: 'Warm', color: 'orange', note: 'Getting close.' },
  cool: { label: 'Cool', color: 'blue', note: 'Not far, keep looking.' },
  cold: { label: 'Cold', color: 'lavender', note: 'Nobody near you.' },
};
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function GameNewSheet({ onClose }) {
  const { friends, schoolId, showToast, setSheet } = useApp();
  const [invite, setInvite] = useState([]);
  const [minutes, setMinutes] = useState(20);
  const [radius, setRadius] = useState(500);
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try {
      if (!(await getForegroundPermission(true))) throw new Error('Hide and seek needs location while Flyer is open.');
      const pos = await currentPosition();
      const c = pos || { lat: (SCHOOLS.find((s) => s.id === schoolId) || SCHOOLS[0]).center.latitude, lng: (SCHOOLS.find((s) => s.id === schoolId) || SCHOOLS[0]).center.longitude };
      const r = await api.gameCreate({ invite, minutes, radius, center: c });
      setSheet({ type: 'game', id: r.data.id });
    } catch (e) { showToast(e.message); }
    setBusy(false);
  };
  return (
    <Sheet title="Hide and seek" hand="Friends only. The play area is centered where you are." onClose={onClose} height={0.92}
      footer={<Button title="Create game" icon="gamepad" loading={busy} disabled={!invite.length} onPress={create} />}>
      <T kind="tiny" style={{ marginBottom: 6 }}>How long</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{[10, 20, 30, 45, 60].map((m) => <Chip key={m} label={`${m} min`} active={minutes === m} onPress={() => setMinutes(m)} />)}</View>
      <T kind="tiny" style={{ marginTop: 8, marginBottom: 6 }}>Play area</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{[[250, 'A few buildings'], [500, 'Part of campus'], [900, 'Most of campus']].map(([r, l]) => <Chip key={r} label={l} active={radius === r} onPress={() => setRadius(r)} />)}</View>
      <T kind="tiny" style={{ marginTop: 8, marginBottom: 6 }}>Invite</T>
      {friends.length ? friends.map((f, i) => (
        <PersonRow key={f.uid} person={f} last={i === friends.length - 1} onPress={() => setInvite((p) => (p.includes(f.uid) ? p.filter((x) => x !== f.uid) : [...p, f.uid]))}
          right={<Check checked={invite.includes(f.uid)} onPress={() => setInvite((p) => (p.includes(f.uid) ? p.filter((x) => x !== f.uid) : [...p, f.uid]))} label={f.name} />} />
      )) : <Empty icon="users" title="Add friends to play" />}
      <SectionNote icon="shield">Stay in public places, stay on campus, and look up from your phone when you're walking.</SectionNote>
    </Sheet>
  );
}

export function GameSheet({ id, onClose }) {
  const { t } = useTheme();
  const { user, showToast } = useApp();
  const [g, setG] = useState(undefined);
  const [now, setNow] = useState(Date.now());
  const [code, setCode] = useState(null);
  const [hint, setHint] = useState(null);
  const [scan, setScan] = useState(false);
  const [seekers, setSeekers] = useState([]);
  const [out, setOut] = useState(false);
  const pinger = useRef(null);
  useEffect(() => listenDoc(`games/${id}`, setG), [id]);
  useEffect(() => { const x = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(x); }, []);
  const me = user?.uid;
  const role = g?.roles?.[me];
  const live = g?.status === 'live';
  useEffect(() => {
    if (!live) return undefined;
    if (role === 'hider' && !code) api.gameMyCode({ id }).then((r) => setCode(r.data.code)).catch(() => {});
    const ping = async () => { const pos = await currentPosition(); if (pos) { try { const r = await api.gamePing({ id, lat: pos.lat, lng: pos.lng }); setOut(!!r.data.outOfBounds); } catch (e) { /* retry next */ } } };
    ping();
    pinger.current = setInterval(ping, 20000);
    if (KeepAwake?.activateKeepAwakeAsync) KeepAwake.activateKeepAwakeAsync('flyer-game').catch(() => {});
    return () => { clearInterval(pinger.current); if (KeepAwake?.deactivateKeepAwake) KeepAwake.deactivateKeepAwake('flyer-game'); };
  }, [live, role]);
  if (g === undefined) return <Sheet title="Hide and seek" onClose={onClose}><Loading /></Sheet>;
  if (!g) return <Sheet title="Hide and seek" onClose={onClose}><Empty icon="gamepad" title="That game ended." /></Sheet>;
  const isHost = g.host === me;
  const invited = (g.invited || []).includes(me);
  const players = g.players.map((p) => ({ uid: p, ...(g.cards?.[p] || {}) }));
  const getHint = async () => { try { const r = await api.gameHint({ id }); setHint(r.data); } catch (e) { showToast(e.message); } };
  const tag = async (text) => {
    const m = String(text).match(/^FLYERSEEK:([A-Z0-9]+):([A-Z0-9]+)$/);
    if (!m || m[1] !== id) { showToast("That's not a hider in this game."); return true; }
    try { const r = await api.gameFound({ id, code: m[2] }); showToast(r.data.already ? 'Already tagged' : `Tagged ${r.data.name || 'a hider'}! +40`); } catch (e) { showToast(e.message); }
    return true;
  };
  return (
    <Sheet title="Hide and seek" hand={g.status === 'lobby' ? 'Waiting to start' : live ? `${role === 'seeker' ? 'You are seeking' : 'You are hiding'} · ${mmss(g.endsAt - now)} left` : 'Game over'} onClose={onClose} height={0.95}
      footer={g.status === 'lobby' ? (
        isHost ? <Button title="Start" icon="gamepad" disabled={g.players.length < 2} onPress={() => api.gameStart({ id, seekers: seekers.length ? seekers : [me] }).catch((e) => showToast(e.message))} />
          : invited ? <Button title="Join the game" icon="check" onPress={() => api.gameJoin({ id }).catch((e) => showToast(e.message))} />
            : <Button title="Leave" kind="ghost" onPress={() => api.gameEnd({ id, leave: true }).then(onClose)} />
      ) : live ? (
        isHost ? <Button title="End the game" kind="danger" onPress={() => api.gameEnd({ id }).catch((e) => showToast(e.message))} /> : <Button title="Leave the game" kind="ghost" onPress={() => api.gameEnd({ id, leave: true }).then(onClose)} />
      ) : null}>
      {g.status === 'lobby' ? (
        <>
          <T kind="small" style={{ marginBottom: 8 }}>{isHost ? 'Tap people to make them seekers (you seek by default).' : 'The host picks the seekers.'}</T>
          {players.map((p, i) => (
            <PersonRow key={p.uid} person={p} last={i === players.length - 1} meta={p.uid === g.host ? 'Host' : null}
              onPress={isHost ? () => setSeekers((s) => (s.includes(p.uid) ? s.filter((x) => x !== p.uid) : [...s, p.uid])) : undefined}
              right={(seekers.length ? seekers : [g.host]).includes(p.uid) ? <Chip label="Seeker" active color="pink" /> : <Chip label="Hider" />} />
          ))}
          {(g.invited || []).length ? <T kind="small" style={{ marginTop: 8 }}>{g.invited.length} invited, not joined yet.</T> : null}
        </>
      ) : null}
      {live && now < g.hideUntil ? (
        <PostIt color="yellow" tape style={{ alignItems: 'center' }}>
          <PT kind="tiny">{role === 'seeker' ? 'Count it out! Hiders are hiding' : 'Go hide!'}</PT>
          <T kind="marker" color="#1F2A44" style={{ fontSize: 54, lineHeight: 62 }}>{mmss(g.hideUntil - now)}</T>
        </PostIt>
      ) : null}
      {live && role === 'hider' ? (
        <View style={{ alignItems: 'center', marginTop: 14 }}>
          {g.found?.[me] ? (
            <StampThunk play><RubberStamp label="Found" sub={`by ${g.cards?.[g.found[me].by]?.name || 'a seeker'}`} size={140} color={t.redPen} /></StampThunk>
          ) : (
            <PostIt color="green" tilt={-1} padding={16} style={{ alignItems: 'center' }}>
              <PT kind="bold">If a seeker finds you, show them this</PT>
              {code ? <QRCode value={`FLYERSEEK:${id}:${code}`} size={200} /> : <Loading />}
              <PT kind="small" style={{ marginTop: 6 }}>Code {code}</PT>
            </PostIt>
          )}
        </View>
      ) : null}
      {live && role === 'seeker' && now >= g.hideUntil ? (
        <View style={{ marginTop: 10 }}>
          {hint ? (
            <PostIt color={BAND[hint.band].color} tape style={{ alignItems: 'center', marginBottom: 14 }}>
              <T kind="marker" color="#1F2A44" style={{ fontSize: 46, lineHeight: 54 }}>{BAND[hint.band].label}</T>
              <PT>{BAND[hint.band].note}</PT>
              <PT kind="small">{hint.left} {hint.left === 1 ? 'hider' : 'hiders'} left</PT>
            </PostIt>
          ) : null}
          <View style={{ flexDirection: 'row' }}>
            <Button title="Get a hint" icon="target" onPress={getHint} style={{ flex: 1, marginRight: 8 }} />
            <Button title="Tag a hider" icon="scan" kind="ghost" onPress={() => setScan(true)} style={{ flex: 1 }} />
          </View>
          <T kind="small" color={t.pencil} style={{ marginTop: 6 }}>One hint every 20 seconds.</T>
        </View>
      ) : null}
      {live && out ? <PostIt color="pink" style={{ marginTop: 14 }}><PT kind="bold">You're outside the play area. Head back toward the middle.</PT></PostIt> : null}
      {live ? (
        <Card style={{ marginTop: 16 }}>
          <T kind="tiny" style={{ marginBottom: 4 }}>Players</T>
          {players.map((p, i) => <PersonRow key={p.uid} person={p} last={i === players.length - 1} size={32} meta={g.roles?.[p.uid] === 'seeker' ? 'Seeker' : g.found?.[p.uid] ? 'Found' : 'Hiding'} />)}
        </Card>
      ) : null}
      {g.status === 'ended' ? (
        <View style={{ alignItems: 'center' }}>
          <StampThunk play><RubberStamp label="Game over" size={130} color="#7B4FC9" /></StampThunk>
          {players.filter((p) => g.roles?.[p.uid] === 'hider').map((p) => (
            <T key={p.uid} kind="body" style={{ marginTop: 6 }}>{p.name}: {g.found?.[p.uid] ? `found by ${g.cards?.[g.found[p.uid].by]?.name || 'a seeker'}` : 'never found (+60)'}</T>
          ))}
          <T kind="small" style={{ marginTop: 10 }}>Everyone who played got the Hide & seek stamp.</T>
        </View>
      ) : null}
      {scan ? <ScannerSheet title="Tag a hider" hand="Scan the code on their phone." allowTyping={false} onCode={tag} onClose={() => setScan(false)} /> : null}
      <SectionNote icon="lock">Nobody sees anyone's location. Hints only say how close the nearest hider is.</SectionNote>
    </Sheet>
  );
}
