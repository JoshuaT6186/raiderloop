/**
 * Campus → Hub. Everything a university has that's hard to find, on
 * one page: a "How do I…?" search that answers from verified TTU
 * links (and hands anything else to Pilot), section cards, and the
 * next few deadlines.
 */
import React, { useMemo, useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme/ThemeContext';
import { Page } from '../ui/Page';
import {
  T, PostIt, PT, Card, Section, Button, Row, Field,
} from '../ui/Paper';
import { Washi } from '../ui/Scrap';
import Icon from '../ui/Icon';
import { tap } from '../lib/native';
import { openUrl, call } from '../lib/links';
import { searchHelp, upcomingDates, dateLabel, HELP_SUGGESTIONS, HEALTH } from '../data/hub';
import LastChecked from '../ui/LastChecked';
import { CHECKED } from '../config';

export function ModeSwitch() {
  const { campusMode, setCampusMode } = useApp();
  const { t, f } = useTheme();
  const opts = [['map', 'Map', 'map'], ['hub', 'Hub', 'grid']];
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', alignSelf: 'flex-start', backgroundColor: t.card, borderRadius: 999, borderWidth: 2, borderColor: t.mode === 'dark' ? t.borderStrong : '#1F2A44', padding: 3 }}>
      {opts.map(([id, label, icon]) => {
        const on = campusMode === id;
        return (
          <Pressable key={id} onPress={() => { tap(); setCampusMode(id); }} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={label}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: on ? t.highlight : 'transparent' }}>
            <Icon name={icon} size={15} color={on ? '#1F2A44' : t.pencil} style={{ marginRight: 4 }} />
            <Text style={{ fontFamily: f.bodyBold, fontWeight: f.bodyBold ? undefined : '700', fontSize: 13, color: on ? '#1F2A44' : t.pencil }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const SECTIONS = [
  /* School */
  { id: 'courses', group: 'school', flag: 'courses', title: 'Classes', sub: 'Catalog lookup, study rooms', icon: 'book', tape: 'dots', color: '#C9B6F2', sheet: { type: 'course' } },
  { id: 'majors', group: 'school', title: 'Major Explorer', sub: 'What each major is really like', icon: 'cap', tape: 'grid', color: '#9DBFEA', sheet: { type: 'majors' } },
  { id: 'roadmap', group: 'school', title: 'Roadmap', sub: 'Your degree, semester by semester', icon: 'route', tape: 'stripes', color: '#F2CD6E', sheet: { type: 'roadmap' } },
  { id: 'missed', group: 'school', title: 'Missed class', sub: "Catch up on what you missed", icon: 'clipboard', tape: 'dots', color: '#F4A9B8', sheet: { type: 'missed' } },
  { id: 'queue', group: 'school', title: 'Office hours', sub: 'Get in line without standing in the hall', icon: 'hourglass', tape: 'grid', color: '#9FDCC0', sheet: { type: 'queue' } },
  { id: 'syllabus', group: 'school', title: 'Syllabus drop', sub: 'Every date into your Planner', icon: 'upload', tape: 'stripes', color: '#E8A15C', sheet: { type: 'syllabus' } },
  /* Getting around */
  { id: 'rooms', group: 'around', title: 'Find a room', sub: 'Floor, doors, elevator status', icon: 'door', tape: 'dots', color: '#9DBFEA', sheet: { type: 'rooms' } },
  { id: 'safewalk', group: 'around', title: 'Safe Walk', sub: 'Friends watch you get home', icon: 'shield', tape: 'stripes', color: '#F4A9B8', sheet: { type: 'safewalk' } },
  /* Life */
  { id: 'jobs', group: 'life', flag: 'jobs', title: 'Jobs Hub', sub: 'Every job board, one tracker', icon: 'briefcase', tape: 'stripes', color: '#F2CD6E', sheet: { type: 'jobs' } },
  { id: 'money', group: 'life', flag: 'money', title: 'Money', sub: 'Scholarships, aid, bills, help', icon: 'dollar', tape: 'dots', color: '#9FDCC0', sheet: { type: 'money' } },
  { id: 'forms', group: 'life', flag: 'forms', title: 'Forms', sub: 'Drop, register, transcripts', icon: 'clipboard', tape: 'grid', color: '#9DBFEA', sheet: { type: 'forms' } },
  { id: 'health', group: 'life', flag: 'health', title: 'Health & Safety', sub: 'Counseling, doctor, rides', icon: 'heart', tape: 'stripes', color: '#F4A9B8', sheet: { type: 'health' } },
  { id: 'wellness', group: 'life', title: 'Sleep & steps', sub: 'Apple Health next to your schedule', icon: 'bed', tape: 'dots', color: '#C9B6F2', sheet: { type: 'wellness' } },
  { id: 'deals', group: 'life', flag: 'deals', title: 'Student deals', sub: 'Places that take your ID', icon: 'tag', tape: 'stripes', color: '#9FD3A8', sheet: { type: 'deals' } },
  { id: 'tools', group: 'life', flag: 'tools', title: 'Tools', sub: 'Scientific & graphing calculators', icon: 'calculator', tape: 'grid', color: '#E8A15C', sheet: { type: 'tools' } },
  { id: 'first', group: 'life', title: 'First 30 days', sub: 'A short checklist for new students', icon: 'list', tape: 'dots', color: '#F2CD6E', sheet: { type: 'firstWeeks' } },
];
const GROUPS = [['school', 'School', 'cap'], ['around', 'Getting around', 'walk'], ['life', 'Life', 'heart']];

function SectionCard({ s, i }) {
  const { setSheet } = useApp();
  return (
    <View style={{ width: '48%', marginBottom: 16 }}>
      <Card onPress={() => setSheet(s.sheet)} header={false} style={{ minHeight: 104, transform: [{ rotate: `${i % 2 ? 0.7 : -0.7}deg` }] }}>
        <Icon name={s.icon} size={22} />
        <T kind="handBig" style={{ fontSize: 24, lineHeight: 26, marginTop: 4 }} numberOfLines={1}>{s.title}</T>
        <T kind="small" style={{ fontSize: 12, lineHeight: 16 }} numberOfLines={2}>{s.sub}</T>
      </Card>
      <Washi pattern={s.tape} color={s.color} width={50} height={16} angle={i % 2 ? -4 : 4} />
    </View>
  );
}

function ComingUp() {
  const { t } = useTheme();
  const list = upcomingDates(new Date(), 3);
  if (!list.length) return null;
  const when = (d) => (d.days <= 0 ? (d.end ? 'now' : 'today') : d.days === 1 ? 'tomorrow' : `in ${d.days} days`);
  return (
    <PostIt color="yellow" tilt={-0.6} tape style={{ marginTop: 4 }}>
      <PT kind="title" style={{ fontSize: 20 }}>Coming up</PT>
      {list.map((d) => (
        <Pressable key={d.date + d.title} onPress={() => openUrl(d.source)} accessibilityRole="link" style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 5 }}>
          <View style={{ width: 92 }}><PT kind="bold">{dateLabel(d)}</PT></View>
          <View style={{ flex: 1 }}>
            <PT kind="body">{d.title}</PT>
            <T kind="small" color={d.days <= 7 ? t.redPen : '#4B5571'}>{when(d)}</T>
          </View>
        </Pressable>
      ))}
      <PT kind="small" style={{ marginTop: 4 }}>From the official 2026–27 academic calendar. Tap a date to see the source.</PT>
    </PostIt>
  );
}

export default function CampusHub() {
  const { t } = useTheme();
  const { setSheet, askPilot, flags } = useApp();
  const [q, setQ] = useState('');
  const results = useMemo(() => searchHelp(q), [q]);
  const sections = SECTIONS.filter((s) => flags[s.flag] !== false);
  const searching = q.trim().length > 1;
  const crisis = HEALTH.crisis[0];

  return (
    <Page eyebrow="everything in one place" title="Campus" right={<ModeSwitch />} paper="graph">
      <Field placeholder="How do I…?" value={q} onChangeText={setQ} style={{ marginTop: 12, marginBottom: 8 }} returnKeyType="search" clearButtonMode="while-editing" autoCorrect={false} />

      {searching ? (
        <View>
          {results.length ? (
            <Card>
              {results.map((r, i) => (
                <Row key={r.id} title={r.title} meta={r.body} last={i === results.length - 1}
                  left={<Icon name={r.sheet ? 'chevronRight' : 'link'} size={18} color={t.inkSoft} />}
                  onPress={() => (r.sheet ? setSheet(r.sheet) : openUrl(r.url))} />
              ))}
            </Card>
          ) : <T kind="hand">No quick answer for that one.</T>}
          <Button title={`Ask Pilot: "${q.trim().slice(0, 40)}"`} icon="plane" kind="ghost" small onPress={() => askPilot(q.trim())} style={{ marginTop: 12 }} />
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
            {HELP_SUGGESTIONS.map((s, i) => (
              <Pressable key={s} onPress={() => { tap(); setQ(s); }} accessibilityRole="button"
                style={{ backgroundColor: t.postit[['yellow', 'pink', 'green', 'blue', 'orange'][i % 5]], paddingHorizontal: 10, paddingVertical: 6, marginRight: 8, marginBottom: 8, transform: [{ rotate: `${i % 2 ? 1.5 : -1.5}deg` }] }}>
                <PT kind="small" style={{ fontSize: 12.5 }}>{s}</PT>
              </Pressable>
            ))}
          </View>

          <ComingUp />
          <LastChecked date={CHECKED.term} source="2026–27 academic calendar" itemId="hub:dates" title="Coming up dates" />

          {GROUPS.map(([g, label, icon]) => {
            const list = sections.filter((x) => x.group === g);
            if (!list.length) return null;
            return (
              <View key={g}>
                <Section title={label} icon={icon} />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  {list.map((x, i) => <SectionCard key={x.id} s={x} i={i} />)}
                </View>
              </View>
            );
          })}

          <Section title="Need to talk?" icon="heart" />
          <PostIt color="pink" tilt={0.6} onPress={() => call(crisis.phone)} accessibilityLabel={`Call ${crisis.name}`}>
            <PT kind="bold">{crisis.name}: {crisis.phone}</PT>
            <PT kind="small" style={{ marginTop: 2 }}>{crisis.note} Tap to call.</PT>
          </PostIt>
          <LastChecked date={CHECKED.hub} source="TTU Student Counseling Center" itemId="hub:crisis" title={crisis.name} />
        </>
      )}
    </Page>
  );
}
