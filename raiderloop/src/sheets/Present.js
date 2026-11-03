/**
 * Present Mode: put your slides, a doc, photos, or a PDF on a TV or
 * the class PC. On the big screen, open <share site>/present/ (no
 * login, no app) and type its code here, or scan the QR it shows.
 * Your phone becomes the remote.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  Sheet, T, PostIt, PT, Card, Button, Row, Field, Loading,
} from '../ui/Paper';
import { SectionNote } from '../ui/Kit';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api, listenDoc } from '../lib/firebase';
import { pickPhoto, pickDocument, upload, uploadError } from '../lib/upload';
import { parseLink } from '../lib/deeplinks';
import { SHARE } from '../config';
import { ScannerSheet } from './Scanner';
import { fileKind } from './Groups';

export function PresentSheet({ code: initialCode, groupId, onClose }) {
  const { t } = useTheme();
  const { groups, showToast } = useApp();
  const [code, setCode] = useState(initialCode ? String(initialCode).toUpperCase() : '');
  const [claimed, setClaimed] = useState(null);
  const [doc, setDoc] = useState(null);
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState(false);
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const group = groups.find((g) => g.id === groupId);
  const claim = async (c) => {
    setBusy(true);
    try { const r = await api.presentClaim({ code: c }); setClaimed(r.data.code); } catch (e) { showToast(e.message); }
    setBusy(false);
  };
  useEffect(() => { if (initialCode) claim(String(initialCode).toUpperCase()); }, []);
  useEffect(() => (claimed ? listenDoc(`present/${claimed}`, setDoc) : undefined), [claimed]);
  const show = async (args) => {
    setBusy(true);
    try { await api.presentShow({ code: claimed, ...args }); } catch (e) { showToast(uploadError(e)); }
    setBusy(false);
  };
  const showUpload = async (fn, append) => {
    try { const f = await fn(); if (!f) return; setBusy(true); const path = await upload(f); await api.presentShow({ code: claimed, uploadPath: path, append }); } catch (e) { showToast(uploadError(e)); }
    setBusy(false);
  };
  const item = doc?.item;
  const nav = (d) => api.presentNav({ code: claimed, index: (item?.index || 0) + d }).catch(() => {});
  const end = async () => { await api.presentEnd({ code: claimed }).catch(() => {}); onClose(); };
  return (
    <Sheet title="Present" hand={claimed ? `Connected to screen ${claimed}` : 'Your phone is the remote.'} onClose={onClose} height={0.94}
      footer={claimed ? <Button title="Stop presenting" kind="danger" onPress={end} /> : null}>
      {!claimed ? (
        <>
          <PostIt color="yellow" tape tilt={-0.8}>
            <PT kind="bold">On the TV or class PC, open:</PT>
            <PT kind="title" style={{ marginTop: 4 }}>{SHARE.base.replace(/^https:\/\//, '')}{SHARE.presentPath}</PT>
            <PT kind="small" style={{ marginTop: 4 }}>It shows a 6-letter code. Type it below or scan the QR on the screen.</PT>
          </PostIt>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 16 }}>
            <Field placeholder="TV code" value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" maxLength={8} style={{ flex: 1, marginRight: 8 }} />
            <Button title="Connect" small loading={busy} disabled={code.trim().length < 6} onPress={() => claim(code.trim())} style={{ marginTop: 2 }} />
          </View>
          <Button title="Scan the screen's QR" icon="scan" kind="ghost" small onPress={() => setScan(true)} style={{ alignSelf: 'flex-start' }} />
        </>
      ) : (
        <>
          {item ? (
            <Card style={{ marginBottom: 14 }}>
              <T kind="tiny">On screen now</T>
              <T kind="bold">{item.title || (item.kind === 'images' ? 'Photos' : item.kind === 'pdf' ? 'PDF' : item.kind === 'note' ? 'Note' : item.url)}</T>
              {item.kind === 'images' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                  <Button title="Back" icon="chevronLeft" small kind="ghost" disabled={(item.index || 0) <= 0} onPress={() => nav(-1)} style={{ flex: 1, marginRight: 8 }} />
                  <T kind="num">{(item.index || 0) + 1} / {item.images.length}</T>
                  <Button title="Next" small onPress={() => nav(1)} disabled={(item.index || 0) >= item.images.length - 1} style={{ flex: 1, marginLeft: 8 }} />
                </View>
              ) : null}
              {item.kind === 'images' ? <Button title="Add another photo" icon="plus" small kind="ghost" onPress={() => showUpload(() => pickPhoto(), true)} style={{ marginTop: 10, alignSelf: 'flex-start' }} /> : null}
            </Card>
          ) : <T kind="small" style={{ marginBottom: 10 }}>Connected. Pick something to show.</T>}
          {busy ? <Loading label="Sending to the screen…" /> : null}
          {group && (group.files || []).length ? (
            <Card style={{ marginBottom: 14 }}>
              <T kind="tiny" style={{ marginBottom: 4 }}>From {group.name}</T>
              {group.files.map((f, i) => {
                const k = f.stored ? { label: f.kind === 'pdf' ? 'PDF' : 'Photo', icon: f.kind === 'pdf' ? 'file' : 'image' } : fileKind(f.url);
                return <Row key={f.id} title={f.title} meta={k.label} left={<Icon name={k.icon} color={t.ink} />} last={i === group.files.length - 1}
                  onPress={() => show(f.stored && f.kind === 'photo' ? { item: { kind: 'images', images: [f.url], title: f.title } } : f.stored ? { item: { kind: 'link', url: f.url, title: f.title } } : { item: { kind: 'link', url: f.url, title: f.title } })} />;
              })}
            </Card>
          ) : null}
          <Field label="Show a link" value={link} onChangeText={setLink} autoCapitalize="none" keyboardType="url" placeholder="Google Slides, Canva, YouTube, any page" />
          <Button title="Show link" icon="tv" small disabled={!/\S+\.\S+/.test(link)} onPress={() => show({ item: { kind: 'link', url: /^https?:\/\//.test(link.trim()) ? link.trim() : `https://${link.trim()}` } })} style={{ alignSelf: 'flex-start', marginBottom: 14 }} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
            <Button title="Photos" icon="image" small kind="ghost" onPress={() => showUpload(() => pickPhoto(), false)} style={{ marginRight: 8, marginBottom: 8 }} />
            <Button title="PDF" icon="file" small kind="ghost" onPress={() => showUpload(() => pickDocument({ types: ['application/pdf'] }), false)} style={{ marginBottom: 8 }} />
          </View>
          <Field label="Or show a note" value={note} onChangeText={setNote} multiline inputStyle={{ minHeight: 70 }} placeholder="Agenda: 1) intro 2) demo 3) questions" />
          <Button title="Show note" small kind="ghost" disabled={!note.trim()} onPress={() => show({ item: { kind: 'note', text: note } })} style={{ alignSelf: 'flex-start' }} />
          <SectionNote icon="info">Google Slides, Docs, Canva and YouTube links open right on the screen. Other links show a big QR and an Open button.</SectionNote>
        </>
      )}
      {scan ? (
        <ScannerSheet title="Scan the screen" hand="Point at the QR on the TV or PC." allowTyping={false} onClose={() => setScan(false)}
          onCode={(text) => { const l = parseLink(text); if (l && l.type === 'present') { setCode(l.id); claim(l.id); return true; } showToast("That's not a Flyer screen code."); return true; }} />
      ) : null}
    </Sheet>
  );
}
