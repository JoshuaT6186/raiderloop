/**
 * Major Explorer and Graduation Roadmap.
 *   • Explorer: browse majors by field, read what each one is (from the
 *     official catalog), see related orgs, and jump to the degree plan.
 *   • Roadmap: the official degree plan as a checklist. Check off what
 *     you've finished; classes on your schedule show as in progress.
 * Both say where the info came from, and the roadmap never replaces
 * your advisor or degree audit.
 */
import React, { useMemo, useState } from 'react';
import { View, Pressable } from 'react-native';
import {
  Sheet, T, PostIt, PT, Card, Button, Row, Chip, Field, Loading, Empty, Check,
} from '../ui/Paper';
import { SectionNote, Pill, Highlighter } from '../ui/Kit';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api } from '../lib/firebase';
import { useCallable } from '../lib/hooks';
import { openUrl } from '../lib/links';
import { MAJORS } from '../data/majors';
import { ORGS } from '../data/campus';

export const FIELDS = [
  ['Engineering & Computing', /engineer|comput|computer|technology|software|cyber|data/i],
  ['Business', /account|business|finance|market|management|economics|real estate|retail|hospitality|energy commerce|supply/i],
  ['Science & Math', /biology|chem|physics|math|statistic|geo|science|environment|microbio|astro|biochem/i],
  ['Health & Human Sciences', /nutrition|kinesiology|health|nursing|human|family|exercise|speech|dietetic|addiction|personal finance/i],
  ['Arts, Media & Design', /art|design|music|theat|media|journal|advertis|public relations|communication|architect|dance|photo|film|apparel/i],
  ['Agriculture & Natural Resources', /agri|animal|plant|soil|wildlife|range|food|horticult|turf|natural resource|conservation/i],
  ['Education', /education|teach|learning/i],
  ['Humanities & Social Sciences', /history|english|philosoph|psych|sociolog|political|anthrop|language|spanish|french|german|classics|crimin|religio|global|international|honors|multidisciplinary|leadership/i],
];
export const fieldOf = (m) => (FIELDS.find(([, re]) => re.test(m)) || ['Other'])[0];

function MajorDetail({ name, onRoadmap }) {
  const { t } = useTheme();
  const { set, userMajor, showToast } = useApp();
  const m = useCallable(api.getMajor, { name }, 'major', { asArray: false });
  const words = name.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 4);
  const orgs = useMemo(() => ORGS.filter((o) => words.some((w) => `${o.name} ${o.reason || ''}`.toLowerCase().includes(w))).slice(0, 6), [name]);
  return (
    <View>
      {m.loading ? <Loading label="Reading the catalog…" /> : m.data && m.data.found ? (
        <PostIt color="yellow" tape tilt={-0.6}>
          <PT kind="tiny">{m.data.college}</PT>
          <PT style={{ marginTop: 4 }}>{m.data.summary}</PT>
          {(m.data.youllStudy || []).length ? <><PT kind="tiny" style={{ marginTop: 10 }}>You'll study</PT><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{m.data.youllStudy.map((x) => <Pill key={x} label={x} />)}</View></> : null}
          {(m.data.careers || []).length ? <><PT kind="tiny" style={{ marginTop: 10 }}>Where it can lead</PT><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{m.data.careers.map((x) => <Pill key={x} label={x} color="green" />)}</View></> : null}
          {m.data.sourceUrl ? <Pressable onPress={() => openUrl(m.data.sourceUrl)}><PT kind="small" style={{ marginTop: 10, textDecorationLine: 'underline' }}>Source: official TTU page</PT></Pressable> : null}
        </PostIt>
      ) : <Card><T kind="small">{m.error || "Flyer couldn't find an official description for this one. The catalog link below has everything."}</T></Card>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 }}>
        <Button title="See the degree plan" icon="route" small onPress={() => onRoadmap(name)} style={{ marginRight: 8, marginBottom: 8 }} />
        {userMajor !== name ? <Button title="This is my major" small kind="ghost" onPress={() => { set({ userMajor: name }); showToast('Major updated'); }} style={{ marginBottom: 8 }} /> : <Pill label="Your major" color="yellow" icon="check" />}
      </View>
      {m.data?.advisingUrl ? <Row title="Talk to an advisor" meta="The best next step if you're deciding" left={<Icon name="users" color={t.ink} />} onPress={() => openUrl(m.data.advisingUrl)} /> : null}
      {orgs.length ? (
        <>
          <T kind="tiny" style={{ marginTop: 12, marginBottom: 6 }}>Orgs to check out</T>
          <Card>{orgs.map((o, i) => <Row key={o.id} title={o.name} meta={o.tags} last={i === orgs.length - 1} />)}</Card>
        </>
      ) : null}
    </View>
  );
}

export function MajorExplorerSheet({ initial, onClose }) {
  const { setSheet } = useApp();
  const [q, setQ] = useState('');
  const [field, setField] = useState(null);
  const [major, setMajor] = useState(initial || null);
  const list = MAJORS.filter((m) => (!field || fieldOf(m) === field) && (!q.trim() || m.toLowerCase().includes(q.trim().toLowerCase())));
  if (major) {
    return (
      <Sheet title={major} hand={fieldOf(major)} onClose={onClose} height={0.95}
        headerRight={<Pressable onPress={() => setMajor(null)} hitSlop={10} style={{ marginTop: 8 }} accessibilityLabel="Back to majors"><Icon name="chevronLeft" size={22} /></Pressable>}>
        <MajorDetail name={major} onRoadmap={(m) => setSheet({ type: 'roadmap', major: m })} />
      </Sheet>
    );
  }
  return (
    <Sheet title="Major Explorer" hand="Still deciding? Browse by what you're into." onClose={onClose} height={0.95}>
      <Field placeholder="Search majors…" value={q} onChangeText={setQ} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
        {FIELDS.map(([f]) => <Chip key={f} label={f} active={field === f} onPress={() => setField(field === f ? null : f)} />)}
      </View>
      <Card>
        {list.map((m, i) => <Row key={m} title={m} meta={fieldOf(m)} onPress={() => setMajor(m)} last={i === list.length - 1} />)}
        {!list.length ? <T kind="small">No majors match that.</T> : null}
      </Card>
      <SectionNote icon="info">Descriptions come from TTU's official pages and are cached for a month.</SectionNote>
    </Sheet>
  );
}

export function RoadmapSheet({ major: initialMajor, onClose }) {
  const { t } = useTheme();
  const { roadmap, set, userMajor, scheduleItems, setSheet } = useApp();
  const [major, setMajor] = useState(initialMajor || roadmap.major || userMajor || '');
  const [typed, setTyped] = useState('');
  const plan = useCallable(api.getDegreePlan, { major }, 'plan', { asArray: false, enabled: !!major });
  const done = new Set(roadmap.done || []);
  const inProgress = new Set(scheduleItems.filter((c) => !c.oneOff).map((c) => (c.title || '').toUpperCase().replace(/\s+/g, ' ')));
  const toggle = (code) => set((p) => ({ roadmap: { ...p.roadmap, major, done: done.has(code) ? p.roadmap.done.filter((x) => x !== code) : [...(p.roadmap.done || []), code] } }));
  const p = plan.data;
  const all = p && p.found ? p.groups.flatMap((g) => g.courses) : [];
  const doneHours = all.filter((c) => done.has(c.code)).reduce((n, c) => n + (c.hours || 3), 0);
  const total = p?.totalHours || all.reduce((n, c) => n + (c.hours || 3), 0) || 120;
  const pct = Math.min(1, doneHours / total);
  if (!major) {
    const hits = MAJORS.filter((m) => m.toLowerCase().includes(typed.trim().toLowerCase())).slice(0, 20);
    return (
      <Sheet title="Graduation roadmap" hand="Pick a major to see its plan." onClose={onClose} height={0.9}>
        <Field placeholder="Search majors…" value={typed} onChangeText={setTyped} />
        <Card>{hits.map((m, i) => <Row key={m} title={m} onPress={() => { setMajor(m); set((s) => ({ roadmap: { ...s.roadmap, major: m } })); }} last={i === hits.length - 1} />)}</Card>
        <Button title="Not sure yet? Explore majors" kind="ghost" small onPress={() => setSheet({ type: 'majors' })} style={{ marginTop: 12, alignSelf: 'flex-start' }} />
      </Sheet>
    );
  }
  return (
    <Sheet title="Graduation roadmap" hand={major} onClose={onClose} height={0.95}
      headerRight={<Pressable onPress={() => setMajor('')} hitSlop={10} style={{ marginTop: 8 }} accessibilityLabel="Change major"><T kind="hand" color={t.accent}>change</T></Pressable>}>
      {plan.loading ? <Loading label="Reading the official degree plan…" /> : !p || !p.found ? (
        <Empty icon="route" title="Couldn't find this plan" body="Some majors list their plans as PDFs that Flyer can't read yet. Your college's advising office has it." />
      ) : (
        <>
          <PostIt color="green" tape tilt={-0.6}>
            <PT kind="tiny">{[p.degree, p.college].filter(Boolean).join(' · ')}</PT>
            <Highlighter><T kind="handBig" color="#1F2A44">{doneHours} of {total} hours</T></Highlighter>
            <View style={{ height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: '#1F2A44', marginTop: 8, overflow: 'hidden', backgroundColor: '#fff' }}>
              <View style={{ width: `${Math.round(pct * 100)}%`, height: '100%', backgroundColor: '#2E8256' }} />
            </View>
            {p.notes ? <PT kind="small" style={{ marginTop: 8 }}>{p.notes}</PT> : null}
          </PostIt>
          {p.groups.map((g) => (
            <Card key={g.name} style={{ marginTop: 14 }}>
              <T kind="title" style={{ fontSize: 18 }}>{g.name}{g.hours ? ` · ${g.hours} hrs` : ''}</T>
              {g.courses.map((c) => (
                <View key={`${g.name}-${c.code}-${c.title}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                  <Check checked={done.has(c.code)} onPress={() => toggle(c.code)} label={c.code || c.title} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <T kind="bold" style={done.has(c.code) ? { textDecorationLine: 'line-through', opacity: 0.6 } : null}>{[c.code, c.title].filter(Boolean).join(' · ')}</T>
                    <T kind="small">{c.hours ? `${c.hours} hrs` : ''}{inProgress.has(c.code) ? ' · on your schedule now' : ''}</T>
                  </View>
                  {c.code ? <Pressable onPress={() => setSheet({ type: 'course', code: c.code })} hitSlop={8}><Icon name="info" size={18} color={t.faint} /></Pressable> : null}
                </View>
              ))}
            </Card>
          ))}
          {p.sourceUrl ? <Button title="Official degree plan" icon="link" small kind="ghost" onPress={() => openUrl(p.sourceUrl)} style={{ marginTop: 14, alignSelf: 'flex-start' }} /> : null}
          <SectionNote icon="info">Plans change by catalog year. Your degree audit (DegreeWorks) and your advisor have the final word. Your checkmarks stay on this phone.</SectionNote>
        </>
      )}
    </Sheet>
  );
}
