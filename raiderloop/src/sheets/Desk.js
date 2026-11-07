/**
 * Desk mode: a calm full-screen view for a laptop or second monitor.
 * A big clock, what's next, today's classes, what's due, and new
 * Flyer Drops. Dims itself at night. Press Escape or Close to leave.
 */
import React, { useEffect } from 'react';
import { View, Modal, Pressable, Platform } from 'react-native';
import { T, PostIt, PT, Button, NotebookBg } from '../ui/Paper';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { useNow } from '../lib/hooks';
import { itemsOnDay, todayCode, toMinutes, sortByTime } from '../lib/time';

export function DeskMode({ onClose }) {
  const { t } = useTheme();
  const { scheduleItems, assignments, drops, user, setSheet, userName } = useApp();
  const now = useNow(15000);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const nowM = now.getHours() * 60 + now.getMinutes();
  const today = sortByTime(itemsOnDay(scheduleItems, todayCode(now)));
  const next = today.find((c) => (toMinutes(c.time) ?? 0) > nowM) || null;
  const minsTo = next ? toMinutes(next.time) - nowM : null;
  const due = (assignments || []).filter((a) => !a.done && a.due).sort((a, b) => new Date(a.due) - new Date(b.due)).slice(0, 4);
  const fresh = (drops || []).filter((d) => d.from !== user?.uid).slice(0, 3);
  const night = now.getHours() >= 22 || now.getHours() < 6;
  const clock = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.paper, opacity: night ? 0.75 : 1 }}>
        <NotebookBg />
        <View style={{ flex: 1, padding: 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View>
              <T kind="hand" color={t.pencil}>{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}{userName ? ` · ${userName.split(' ')[0]}'s desk` : ''}</T>
              <T kind="marker" style={{ fontSize: 120, lineHeight: 130 }}>{clock}</T>
            </View>
            <Button title="Close" kind="ghost" small onPress={onClose} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 20 }}>
            <View style={{ flexGrow: 1, flexBasis: 300, marginRight: 20, marginBottom: 20 }}>
              <PostIt color="yellow" tape tilt={-1} padding={20}>
                <PT kind="tiny">Next up</PT>
                {next ? (
                  <>
                    <PT kind="title" style={{ fontSize: 30, lineHeight: 36, marginTop: 4 }}>{next.title}</PT>
                    <PT kind="body">{minsTo != null && minsTo <= 90 ? `in ${minsTo} min` : next.time}{next.place ? ` · ${next.place}` : ''}</PT>
                  </>
                ) : <PT kind="title" style={{ fontSize: 26, marginTop: 4 }}>Nothing else today. Nice.</PT>}
              </PostIt>
            </View>
            <View style={{ flexGrow: 1, flexBasis: 300, marginRight: 20, marginBottom: 20 }}>
              <PostIt color="green" tilt={0.8} padding={20}>
                <PT kind="tiny">Today</PT>
                {today.length ? today.map((c) => <PT key={c.id} kind="body" style={{ marginTop: 4 }}>{c.time}  {c.title}</PT>) : <PT kind="body" style={{ marginTop: 4 }}>No classes today.</PT>}
              </PostIt>
            </View>
            <View style={{ flexGrow: 1, flexBasis: 300, marginRight: 20, marginBottom: 20 }}>
              <PostIt color="pink" tilt={-0.6} padding={20}>
                <PT kind="tiny">Due soon</PT>
                {due.length ? due.map((a) => <PT key={a.id} kind="body" style={{ marginTop: 4 }}>{a.title} · {new Date(a.due).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</PT>) : <PT kind="body" style={{ marginTop: 4 }}>Nothing due. Nice.</PT>}
              </PostIt>
            </View>
            <View style={{ flexGrow: 1, flexBasis: 300, marginRight: 20, marginBottom: 20 }}>
              <PostIt color="lavender" tilt={0.5} padding={20}>
                <PT kind="tiny">Flyer Drop</PT>
                {fresh.length ? fresh.map((d) => (
                  <Pressable key={d.id} onPress={() => { onClose(); setSheet({ type: 'drop', id: d.id }); }}>
                    <PT kind="body" style={{ marginTop: 4 }}>{d.fromName || 'Someone'}: {d.payload?.title || d.kind}</PT>
                  </Pressable>
                )) : <PT kind="body" style={{ marginTop: 4 }}>Nothing waiting.</PT>}
              </PostIt>
            </View>
          </View>
          <T kind="small" style={{ marginTop: 'auto' }}>Desk mode dims after 10 PM. Press Esc to leave.</T>
        </View>
      </View>
    </Modal>
  );
}
