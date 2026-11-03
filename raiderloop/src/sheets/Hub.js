/**
 * Campus hub sheets: Jobs Hub, Money, Forms, Health & Safety,
 * Classes (catalog + study rooms), and Student deals.
 * Official actions always open the real TTU site; Flyer is the front
 * door and the organizer, never a copy of the form.
 */
import React, { useMemo, useState } from 'react';
import { View, Pressable, Linking, Alert } from 'react-native';
import {
  Sheet, T, PostIt, PT, Card, Button, Row, Chip, Field, Stamp, Loading, Empty, Divider, Highlight,
} from '../ui/Paper';
import { Pushpin } from '../ui/Scrap';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api } from '../lib/firebase';
import { useCallable } from '../lib/hooks';
import { openUrl, call, shareText, openDirections } from '../lib/links';
import { shareThing } from '../lib/share';
import { metaLine } from '../lib/time';
import { SAFETY } from '../config';
import {
  JOB_BOARDS, DEPT_JOBS, JOB_HELP, JOB_STATUSES, MONEY, FORMS, HEALTH, STUDY_ROOMS, STUDY_ROOMS_HELP, CATALOG,
  dateLabel, upcomingDates,
} from '../data/hub';

/* ---------- shared bits ---------- */
function Tabs({ tabs, value, onChange }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', marginBottom: 14 }}>
      {tabs.map((x) => (
        <Pressable key={x.id} onPress={() => onChange(x.id)} accessibilityRole="tab" accessibilityState={{ selected: value === x.id }}
          style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 3, borderColor: value === x.id ? t.accent : 'transparent' }}>
          <Icon name={x.icon} size={18} color={value === x.id ? t.accent : t.pencil} />
          <T kind="small" color={value === x.id ? t.accent : t.pencil} style={{ fontSize: 12 }}>{x.label}</T>
        </Pressable>
      ))}
    </View>
  );
}

function LinkRow({ item, icon = 'link', last }) {
  const { t } = useTheme();
  return (
    <Row title={item.name} meta={item.note} last={last} left={<Icon name={icon} size={18} color={t.inkSoft} />}
      right={item.phone ? (
        <Pressable onPress={() => call(item.phone)} hitSlop={10} accessibilityLabel={`Call ${item.name}`} style={{ marginLeft: 8 }}>
          <Icon name="phone" size={18} color={t.accent} />
        </Pressable>
      ) : null}
      onPress={item.url ? () => openUrl(item.url) : undefined} />
  );
}

const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(10, 0, 0, 0); return d.toISOString(); };
const shortDate = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/* =========================================================
   Jobs Hub
   ========================================================= */
function JobsFind() {
  const { t } = useTheme();
  const { addJobApp, showToast, jobApps } = useApp();
  const live = useCallable(api.getJobs, {}, 'jobs');
  const [type, setType] = useState('All');
  const [allDepts, setAllDepts] = useState(false);
  const jobs = (live.data || []).filter((j) => type === 'All' || j.type === type);
  const types = ['All', ...new Set((live.data || []).map((j) => j.type).filter(Boolean))];
  const tracked = (j) => jobApps.some((a) => a.url && a.url === j.url && a.title === j.title);
  const track = (j) => { addJobApp({ title: j.title, place: j.dept || '', url: j.url || '', status: 'saved' }); showToast('Added to your tracker'); };

  return (
    <View>
      <T kind="tiny" style={{ marginBottom: 6 }}>Official job boards</T>
      <Card>
        {JOB_BOARDS.map((b, i) => <LinkRow key={b.id} item={{ ...b, note: `${b.note}${b.tags ? ` · ${b.tags.join(', ')}` : ''}` }} icon="briefcase" last={i === JOB_BOARDS.length - 1} />)}
      </Card>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 20, marginBottom: 6 }}>
        <T kind="tiny" style={{ flex: 1 }}>Openings spotted this week</T>
        {live.data ? <T kind="small" style={{ fontSize: 11 }}>{live.data.length} found</T> : null}
      </View>
      {live.loading ? <Loading label="Checking TTU job boards…" /> : null}
      {live.error ? <T kind="small" color={t.redPen}>{live.error}</T> : null}
      {!live.loading && !live.error && !(live.data || []).length ? (
        <Card><T kind="hand">nothing new spotted right now</T><T kind="small">The boards above always have the full list.</T></Card>
      ) : null}
      {types.length > 2 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{types.map((x) => <Chip key={x} label={x} active={type === x} onPress={() => setType(x)} />)}</View>
      ) : null}
      {jobs.map((j, i) => (
        <Card key={`${j.title}-${i}`} style={{ marginBottom: 10 }}>
          <T kind="bold">{j.title}</T>
          <T kind="small">{metaLine(j.dept, j.pay, j.hours)}</T>
          {j.posted ? <T kind="small" style={{ fontSize: 11.5 }}>Posted {j.posted}</T> : null}
          <View style={{ flexDirection: 'row', marginTop: 10 }}>
            {j.url ? <Button title="Apply on official site" small onPress={() => openUrl(j.url)} style={{ marginRight: 8 }} /> : null}
            <Button title={tracked(j) ? 'Tracking' : 'Track it'} small kind="ghost" icon={tracked(j) ? 'check' : 'plus'} disabled={tracked(j)} onPress={() => track(j)} />
          </View>
        </Card>
      ))}
      {(live.data || []).length ? <T kind="small" style={{ fontSize: 11.5 }}>Pulled from TTU's own job pages a few times a day. Always apply on the official site.</T> : null}

      <T kind="tiny" style={{ marginTop: 20, marginBottom: 6 }}>Departments that hire students</T>
      <Card>
        {(allDepts ? DEPT_JOBS : DEPT_JOBS.slice(0, 5)).map((d, i, arr) => <LinkRow key={d.id} item={d} icon="building" last={i === arr.length - 1} />)}
        {!allDepts ? <Button title={`All ${DEPT_JOBS.length} departments`} small kind="ghost" onPress={() => setAllDepts(true)} style={{ marginTop: 8 }} /> : null}
      </Card>

      <T kind="tiny" style={{ marginTop: 20, marginBottom: 6 }}>Get help</T>
      <Card>
        <LinkRow item={{ ...JOB_HELP.careerCenter, note: 'Resume reviews, mock interviews' }} icon="cap" />
        <LinkRow item={JOB_HELP.successHub} icon="calendarPlus" />
        <Row title={JOB_HELP.workStudy.name} meta={metaLine(JOB_HELP.workStudy.note, JOB_HELP.workStudy.email)} left={<Icon name="help" size={18} color={t.inkSoft} />}
          right={<Pressable onPress={() => call(JOB_HELP.workStudy.phone)} hitSlop={10} accessibilityLabel="Call Financial Aid about work-study"><Icon name="phone" size={18} color={t.accent} /></Pressable>}
          onPress={() => openUrl(`mailto:${JOB_HELP.workStudy.email}`)} last />
      </Card>
      <Pressable onPress={() => openUrl(JOB_HELP.source)} style={{ marginTop: 10 }}><T kind="small" color={t.accent}>Source: TTU Career Center, On-Campus Jobs</T></Pressable>
    </View>
  );
}

function JobCard({ j }) {
  const { t } = useTheme();
  const { updateJobApp, removeJobApp } = useApp();
  const setStatus = (status) => {
    const patch = { status };
    if (status === 'applied' && !j.appliedAt) { patch.appliedAt = new Date().toISOString(); if (!j.followUp) patch.followUp = addDays(7); }
    if (status === 'closed' || status === 'offer') patch.followUp = null;
    updateJobApp(j.id, patch);
  };
  const confirmRemove = () => Alert.alert('Remove this job?', j.title, [
    { text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => removeJobApp(j.id) },
  ]);
  const late = j.followUp && new Date(j.followUp) < new Date();
  return (
    <Card style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <T kind="bold">{j.title}</T>
          <T kind="small">{metaLine(j.place, j.appliedAt ? `applied ${shortDate(j.appliedAt)}` : null)}</T>
        </View>
        <Pressable onPress={confirmRemove} hitSlop={10} accessibilityLabel={`Remove ${j.title}`}><Icon name="trash" size={18} color={t.faint} /></Pressable>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
        {JOB_STATUSES.map((s) => <Chip key={s.id} label={s.label} color={s.color} active={j.status === s.id} onPress={() => setStatus(s.id)} style={{ paddingHorizontal: 9, paddingVertical: 5 }} />)}
      </View>
      {j.status !== 'closed' && j.status !== 'offer' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
          <Icon name="bell" size={16} color={late ? t.redPen : t.inkSoft} style={{ marginRight: 6 }} />
          <T kind="small" color={late ? t.redPen : undefined} style={{ marginRight: 8 }}>{j.followUp ? `Follow up ${shortDate(j.followUp)}` : 'No follow-up set'}</T>
          <Chip label="+3 days" onPress={() => updateJobApp(j.id, { followUp: addDays(3) })} style={{ paddingHorizontal: 8, paddingVertical: 4 }} />
          <Chip label="+1 week" onPress={() => updateJobApp(j.id, { followUp: addDays(7) })} style={{ paddingHorizontal: 8, paddingVertical: 4 }} />
          {j.followUp ? <Chip label="Clear" onPress={() => updateJobApp(j.id, { followUp: null })} style={{ paddingHorizontal: 8, paddingVertical: 4 }} /> : null}
        </View>
      ) : null}
      {j.url ? <Pressable onPress={() => openUrl(j.url)}><T kind="small" color={t.accent}>Open the posting →</T></Pressable> : null}
    </Card>
  );
}

function JobsTracker() {
  const { jobApps, addJobApp, showToast } = useApp();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [url, setUrl] = useState('');
  const count = (s) => jobApps.filter((j) => j.status === s).length;
  const add = () => {
    addJobApp({ title: title.trim(), place: place.trim(), url: url.trim(), status: 'applied', appliedAt: new Date().toISOString(), followUp: addDays(7) });
    setTitle(''); setPlace(''); setUrl(''); setAdding(false); showToast("Added. We'll remind you to follow up in a week.");
  };
  const stickies = [['applied', 'Applied', 'yellow'], ['interview', 'Interview', 'blue'], ['offer', 'Offers', 'green']];
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
        {stickies.map(([id, label, color], i) => (
          <View key={id} style={{ width: '31%' }}>
            <PostIt color={color} tilt={[-2, 1.5, -1][i]} padding={10} fold={false}>
              <PT kind="handBig" style={{ fontSize: 30, lineHeight: 32 }}>{count(id)}</PT>
              <PT kind="bold" style={{ fontSize: 13 }}>{label}</PT>
            </PostIt>
          </View>
        ))}
      </View>
      {adding ? (
        <Card style={{ marginBottom: 14 }}>
          <Field label="Job title" placeholder="e.g. Student Worker, Dining" value={title} onChangeText={setTitle} />
          <Field label="Where" placeholder="Department or business" value={place} onChangeText={setPlace} />
          <Field label="Link (optional)" placeholder="Paste the posting link" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" />
          <View style={{ flexDirection: 'row' }}>
            <Button title="Add" small disabled={title.trim().length < 2} onPress={add} style={{ marginRight: 8 }} />
            <Button title="Cancel" small kind="ghost" onPress={() => setAdding(false)} />
          </View>
        </Card>
      ) : <Button title="Add a job you applied to" icon="plus" kind="ghost" small onPress={() => setAdding(true)} style={{ marginBottom: 14 }} />}
      {jobApps.length ? jobApps.map((j) => <JobCard key={j.id} j={j} />) : (
        <Empty icon="briefcase" title="Nothing tracked yet" body="Tap Track it on any opening, or add one you applied to somewhere else." />
      )}
      <T kind="small" style={{ marginTop: 6, fontSize: 11.5 }}>Your tracker stays on this phone. Follow-up reminders use your reminder settings.</T>
    </View>
  );
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function JobsProfile() {
  const { applyProfile, set, showToast } = useApp();
  const p = applyProfile;
  const upd = (patch) => set((s) => ({ applyProfile: { ...s.applyProfile, ...patch } }));
  const [refName, setRefName] = useState('');
  const [refContact, setRefContact] = useState('');
  const toggleDay = (d) => upd({ availability: p.availability.includes(d) ? p.availability.filter((x) => x !== d) : [...p.availability, d] });
  const addRef = () => { upd({ references: [...p.references, { name: refName.trim(), contact: refContact.trim() }].slice(0, 4) }); setRefName(''); setRefContact(''); };
  const text = [
    p.skills ? `About me / experience:\n${p.skills}` : null,
    p.availability.length ? `Available: ${DAYS.filter((d) => p.availability.includes(d)).join(', ')}${p.hours ? ` · up to ${p.hours} hrs/week` : ''}` : null,
    p.resume ? `Resume: ${p.resume}` : null,
    p.references.length ? `References:\n${p.references.map((r) => `- ${r.name}${r.contact ? ` (${r.contact})` : ''}`).join('\n')}` : null,
  ].filter(Boolean).join('\n\n');
  return (
    <View>
      <PostIt color="green" tilt={-0.8} style={{ marginBottom: 16 }}>
        <PT kind="bold">Fill this out once.</PT>
        <PT kind="small">Then copy it into any application in two taps. It's saved only on this phone.</PT>
      </PostIt>
      <Field label="About me / experience" placeholder="Classes, clubs, past jobs, skills…" value={p.skills} onChangeText={(v) => upd({ skills: v })} multiline inputStyle={{ minHeight: 90, textAlignVertical: 'top' }} />
      <T kind="tiny" style={{ marginBottom: 6 }}>Days I can work</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{DAYS.map((d) => <Chip key={d} label={d} active={p.availability.includes(d)} onPress={() => toggleDay(d)} />)}</View>
      <Field label="Hours per week" placeholder="e.g. 15" value={p.hours} onChangeText={(v) => upd({ hours: v.replace(/[^0-9]/g, '').slice(0, 2) })} keyboardType="number-pad" style={{ marginTop: 6 }} />
      <Field label="Resume link" placeholder="Google Drive, OneDrive or LinkedIn link" value={p.resume} onChangeText={(v) => upd({ resume: v })} autoCapitalize="none" keyboardType="url" />
      <T kind="tiny" style={{ marginBottom: 6 }}>References</T>
      {p.references.map((r, i) => (
        <Row key={`${r.name}-${i}`} title={r.name} meta={r.contact} right={<Pressable onPress={() => upd({ references: p.references.filter((_, k) => k !== i) })} hitSlop={10} accessibilityLabel={`Remove ${r.name}`}><Icon name="close" size={16} /></Pressable>} last={i === p.references.length - 1} />
      ))}
      {p.references.length < 4 ? (
        <Card style={{ marginTop: 6 }}>
          <Field placeholder="Name and role (e.g. Ms. Lee, AP Bio teacher)" value={refName} onChangeText={setRefName} style={{ marginBottom: 8 }} />
          <Field placeholder="Email or phone" value={refContact} onChangeText={setRefContact} autoCapitalize="none" style={{ marginBottom: 8 }} />
          <Button title="Add reference" small kind="ghost" disabled={refName.trim().length < 2} onPress={addRef} />
        </Card>
      ) : null}
      <Button title="Copy or share my info" icon="share" disabled={!text} onPress={() => shareText(text).then(() => showToast('Ready to paste'))} style={{ marginTop: 16 }} />
    </View>
  );
}

export function JobsSheet({ initialTab, onClose }) {
  const [tab, setTab] = useState(initialTab || 'find');
  return (
    <Sheet title="Jobs Hub" hand="Every TTU job board, and one place to track what you applied to." onClose={onClose} height={0.92}>
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'find', label: 'Find', icon: 'search' }, { id: 'tracker', label: 'Tracker', icon: 'clipboard' }, { id: 'profile', label: 'Apply-once', icon: 'pencil' },
      ]} />
      {tab === 'find' ? <JobsFind /> : null}
      {tab === 'tracker' ? <JobsTracker /> : null}
      {tab === 'profile' ? <JobsProfile /> : null}
    </Sheet>
  );
}

/* =========================================================
   Money
   ========================================================= */
export function MoneySheet({ onClose }) {
  const { t } = useTheme();
  const deadlines = upcomingDates(new Date(), 20).filter((d) => d.kind === 'money');
  return (
    <Sheet title="Money" hand="Scholarships, aid, your bill, and help when things get tight." onClose={onClose}>
      {deadlines.length ? (
        <PostIt color="yellow" tilt={-0.8} tape style={{ marginBottom: 18 }}>
          <PT kind="tiny">Money deadlines</PT>
          {deadlines.map((d) => (
            <View key={d.date} style={{ flexDirection: 'row', marginTop: 6 }}>
              <PT kind="bold" style={{ width: 70 }}>{dateLabel(d)}</PT>
              <PT kind="body" style={{ flex: 1 }}>{d.title}</PT>
            </View>
          ))}
        </PostIt>
      ) : null}
      <T kind="tiny" style={{ marginBottom: 6 }}>Scholarships</T>
      <Card>{MONEY.scholarships.map((x, i) => <LinkRow key={x.id} item={x} icon="sparkle" last={i === MONEY.scholarships.length - 1} />)}</Card>
      <T kind="tiny" style={{ marginTop: 18, marginBottom: 6 }}>Financial aid</T>
      <Card>{MONEY.aid.map((x, i) => <LinkRow key={x.id} item={x} icon="dollar" last={i === MONEY.aid.length - 1} />)}</Card>
      <T kind="tiny" style={{ marginTop: 18, marginBottom: 6 }}>Your bill</T>
      <Card>{MONEY.bill.map((x, i) => <LinkRow key={x.id} item={x} icon="clipboard" last={i === MONEY.bill.length - 1} />)}</Card>
      <T kind="tiny" style={{ marginTop: 18, marginBottom: 6 }}>Need help now</T>
      <PostIt color="green" tilt={0.6} padding={6}>
        {MONEY.help.map((x, i) => (
          <Row key={x.id} title={x.name} meta={x.note} last={i === MONEY.help.length - 1} style={{ paddingHorizontal: 8 }}
            right={x.phone ? <Pressable onPress={() => call(x.phone)} hitSlop={10} accessibilityLabel={`Call ${x.name}`}><Icon name="phone" size={18} color="#1F2A44" /></Pressable> : null}
            onPress={() => openUrl(x.url)} />
        ))}
      </PostIt>
      <T kind="small" style={{ marginTop: 14 }}>Scholarship questions: {MONEY.contact.email} · {MONEY.contact.phone}</T>
      <Pressable onPress={() => openUrl('https://www.depts.ttu.edu/scholarships/')}><T kind="small" color={t.accent} style={{ marginTop: 6 }}>Source: TTU Scholarships, Raider Relief, Student Business Services</T></Pressable>
    </Sheet>
  );
}

/* =========================================================
   Forms finder
   ========================================================= */
export function FormsSheet({ onClose }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return FORMS;
    return FORMS.filter((f) => `${f.title} ${f.keywords}`.toLowerCase().includes(s) || s.split(/\s+/).every((w) => `${f.title} ${f.keywords}`.toLowerCase().includes(w)));
  }, [q]);
  return (
    <Sheet title="Forms & how-tos" hand="The real place to do each thing, with the deadline." onClose={onClose} height={0.92}>
      <Field placeholder="Search: drop, transcript, major…" value={q} onChangeText={setQ} autoCorrect={false} clearButtonMode="while-editing" />
      {list.map((f) => (
        <Card key={f.id} style={{ marginBottom: 12 }}>
          <T kind="bold">{f.title}</T>
          <T kind="small" style={{ marginTop: 2 }}>{f.body}</T>
          <Button title={f.cta} small kind="ghost" icon="link" onPress={() => openUrl(f.url)} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
        </Card>
      ))}
      {!list.length ? <Empty icon="clipboard" title={`Nothing for "${q}" yet`} body="Ask Pilot, or check the Registrar's site." action="Registrar" onAction={() => openUrl('https://www.depts.ttu.edu/registrar/')} /> : null}
      <T kind="small" style={{ marginTop: 6, fontSize: 11.5 }}>Flyer only points you to the official page. Deadlines are from the 2026–27 academic calendar.</T>
    </Sheet>
  );
}

/* =========================================================
   Health & safety
   ========================================================= */
export function HealthSheet({ onClose }) {
  const { t } = useTheme();
  const { setSheet } = useApp();
  const help = HEALTH.crisis[0];
  const text988 = () => Linking.openURL('sms:988').catch(() => {});
  return (
    <Sheet title="Health & safety" hand="Care, crisis help, and a safe way home." onClose={onClose}>
      <PostIt color="pink" tilt={-1} tape padding={16}>
        <PT kind="tiny">Any time, day or night</PT>
        <PT kind="title" style={{ marginTop: 2 }}>{help.name}</PT>
        <PT kind="small" style={{ marginTop: 2 }}>{help.note}</PT>
        <Button title={`Call ${help.phone}`} icon="phone" kind="danger" onPress={() => call(help.phone)} style={{ marginTop: 12, backgroundColor: '#fff' }} small />
        <Divider style={{ marginVertical: 12 }} />
        <PT kind="bold">988 Suicide & Crisis Lifeline</PT>
        <PT kind="small">Call or text 988, any time.</PT>
        <View style={{ flexDirection: 'row', marginTop: 10 }}>
          <Button title="Call 988" icon="phone" small kind="ghost" onPress={() => call('988')} style={{ marginRight: 8, backgroundColor: '#fff' }} />
          <Button title="Text 988" icon="message" small kind="ghost" onPress={text988} style={{ backgroundColor: '#fff' }} />
        </View>
        <PT kind="small" style={{ marginTop: 10 }}>If someone is in danger right now, call 911.</PT>
      </PostIt>

      <T kind="tiny" style={{ marginTop: 20, marginBottom: 6 }}>Care on campus</T>
      <Card>{HEALTH.care.map((x, i) => <LinkRow key={x.id} item={x} icon="heart" last={i === HEALTH.care.length - 1} />)}</Card>

      <T kind="tiny" style={{ marginTop: 18, marginBottom: 6 }}>Getting home safe</T>
      <Card>
        {HEALTH.getHome.map((x) => <LinkRow key={x.id} item={x} icon={x.id === 'raiderride' ? 'bus' : 'phone'} />)}
        <Row title={SAFETY.campusPolice.label} meta={SAFETY.campusPolice.phone} left={<Icon name="shield" size={18} color={t.inkSoft} />} onPress={() => call(SAFETY.campusPolice.phone)} />
        <Row title="All safety numbers" left={<Icon name="shield" size={18} color={t.inkSoft} />} onPress={() => setSheet({ type: 'safety' })} last />
      </Card>
      <T kind="small" style={{ marginTop: 12, fontSize: 11.5 }}>Numbers and hours checked against TTU's Student Counseling Center, Dean of Students, and Transportation & Parking pages (Oct 2026).</T>
    </Sheet>
  );
}

/* =========================================================
   Classes: catalog lookup + study rooms
   ========================================================= */
const normCode = (s) => {
  const m = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ' ').trim().match(/^([A-Z]{2,5})\s*(\d{4})$/);
  return m ? `${m[1]} ${m[2]}` : null;
};

function CourseResult({ code }) {
  const { t } = useTheme();
  const r = useCallable(api.getCourse, { code }, 'course', { asArray: false });
  if (r.loading) return <Loading label={`Looking up ${code} in the catalog…`} />;
  if (r.error) return <T kind="small" color={t.redPen}>{r.error}</T>;
  const c = r.data;
  if (!c || !c.found) {
    return (
      <Card>
        <T kind="hand">Couldn't find {code} in the {CATALOG.label}.</T>
        <T kind="small">Check the code, or search the catalog directly.</T>
        <Button title="Open the catalog" small kind="ghost" icon="link" onPress={() => openUrl(CATALOG.searchUrl)} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
      </Card>
    );
  }
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <T kind="bold" style={{ flex: 1, letterSpacing: 0.5 }}>{c.code}</T>
        {c.hours ? <Stamp label={`${c.hours} credit hour${c.hours === '1' ? '' : 's'}`} color={t.accent} /> : null}
      </View>
      <T kind="handBig" style={{ marginTop: 2 }}>{c.title}</T>
      {c.description ? <T kind="body" style={{ marginTop: 6 }}>{c.description}</T> : null}
      {c.prerequisites ? <T kind="small" style={{ marginTop: 8 }}><T kind="small" style={{ fontWeight: '700' }}>Prerequisites: </T>{c.prerequisites}</T> : null}
      {c.core ? <T kind="small" style={{ marginTop: 4 }}><T kind="small" style={{ fontWeight: '700' }}>Counts toward: </T>{c.core}</T> : null}
      <Button title="View in the catalog" small kind="ghost" icon="link" onPress={() => openUrl(c.url || CATALOG.searchUrl)} style={{ marginTop: 12, alignSelf: 'flex-start' }} />
      <T kind="small" style={{ marginTop: 8, fontSize: 11.5 }}>From the {CATALOG.label}. Your advisor and DegreeWorks have the final word on what counts for your degree.</T>
    </Card>
  );
}

export function CourseSheet({ onClose, code: initial }) {
  const { t } = useTheme();
  const { scheduleItems } = useApp();
  const [text, setText] = useState(initial || '');
  const [code, setCode] = useState(normCode(initial));
  const mine = [...new Set(scheduleItems.filter((c) => !c.oneOff).map((c) => normCode(c.title)).filter(Boolean))].slice(0, 8);
  const go = (v) => { const c = normCode(v); if (c) { setText(c); setCode(c); } };
  return (
    <Sheet title="Classes" hand="Look up any class in the catalog, or grab a study room." onClose={onClose} height={0.92}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Field placeholder="Course code, like MATH 1314" value={text} onChangeText={setText} autoCapitalize="characters" autoCorrect={false}
          onSubmitEditing={() => go(text)} returnKeyType="search" style={{ flex: 1, marginRight: 8 }} />
        <Button title="Look up" small disabled={!normCode(text)} onPress={() => go(text)} style={{ marginTop: 2 }} />
      </View>
      {mine.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{mine.map((c) => <Chip key={c} label={c} active={code === c} onPress={() => go(c)} />)}</View> : null}
      {code ? <View style={{ marginTop: 6 }}><CourseResult key={code} code={code} /></View> : (
        <T kind="small" style={{ marginTop: 4 }}>Shows credit hours, the official description, and prerequisites.</T>
      )}

      <View style={{ marginTop: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <Icon name="door" size={20} color={t.ink} style={{ marginRight: 6 }} />
          <T kind="handBig" style={{ fontSize: 26 }}>Book a study room</T>
        </View>
        <T kind="small" style={{ marginBottom: 10 }}>TTU Library group rooms, booked through the Library's own system. Pick your group size:</T>
        <View style={{ flexDirection: 'row' }}>
          {STUDY_ROOMS.map((r, i) => (
            <View key={r.id} style={{ flex: 1, marginRight: i < STUDY_ROOMS.length - 1 ? 8 : 0 }}>
              <PostIt color={['blue', 'green', 'lavender'][i]} tilt={[-1.5, 1, -0.5][i]} padding={10} fold={false} onPress={() => openUrl(r.url)} accessibilityLabel={`Book a room for ${r.label}`}>
                <View style={{ alignItems: 'center' }}>
                  <Icon name="users" size={20} color="#1F2A44" />
                  <PT kind="bold" style={{ fontSize: 13, marginTop: 4 }}>{r.label}</PT>
                </View>
              </PostIt>
            </View>
          ))}
        </View>
        <T kind="small" style={{ marginTop: 10, fontSize: 11.5 }}>Questions about rooms: Library Circulation, {STUDY_ROOMS_HELP.phone}.</T>
      </View>
    </Sheet>
  );
}

/* =========================================================
   Student deals
   ========================================================= */
function DealCard({ d }) {
  const { t } = useTheme();
  const { dealVotes, set, showToast } = useApp();
  const voted = dealVotes[d.id];
  const vote = async (v) => {
    set((p) => ({ dealVotes: { ...p.dealVotes, [d.id]: v } }));
    try { await api.voteDeal({ id: d.id, vote: v }); showToast(v === 'works' ? 'Thanks! Marked as still working' : "Thanks. We'll double-check it"); } catch (e) { showToast(e.message || "Couldn't save that"); }
  };
  const checked = d.lastConfirmedAt ? new Date(d.lastConfirmedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null;
  return (
    <Card style={{ marginBottom: 14, overflow: 'visible' }} header={false}>
      <View style={{ position: 'absolute', top: -8, left: '50%', marginLeft: -8 }}><Pushpin size={16} /></View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <T kind="handBig" style={{ fontSize: 24, lineHeight: 26 }}>{d.name}</T>
          {d.where ? <T kind="small">{d.where}</T> : null}
        </View>
        {d.needsId ? <Stamp label="Bring your ID" color={t.accent} /> : d.online ? <Stamp label="Online" color={t.accent} /> : null}
      </View>
      <Highlight style={{ marginTop: 8 }}><T kind="bold">{d.offer}</T></Highlight>
      {d.fine ? <T kind="small" style={{ marginTop: 4 }}>{d.fine}</T> : null}
      <T kind="small" style={{ marginTop: 6, fontSize: 11.5 }}>
        {metaLine(checked ? `Last checked ${checked}` : null, d.works ? `${d.works} ${d.works === 1 ? 'student says' : 'students say'} it still works` : null) || 'Not checked by students yet'}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
        <Button title={voted === 'works' ? 'Thanks!' : 'Still works'} small kind={voted === 'works' ? 'highlight' : 'ghost'} disabled={!!voted} onPress={() => vote('works')} style={{ marginRight: 8, marginBottom: 6 }} />
        <Button title={voted === 'changed' ? 'Reported' : 'Changed'} small kind="ghost" disabled={!!voted} onPress={() => vote('changed')} style={{ marginRight: 8, marginBottom: 6 }} />
        {d.lat != null ? <Button title="Directions" icon="walk" small onPress={() => openDirections(d)} style={{ marginRight: 8, marginBottom: 6 }} /> : null}
        {d.url ? <Button title="Website" icon="link" small kind="ghost" onPress={() => openUrl(d.url)} style={{ marginRight: 8, marginBottom: 6 }} /> : null}
        <Button title="Send" icon="share" small kind="ghost" onPress={() => shareThing('deal', { title: d.name, desc: d.offer, where: d.where || '', url: d.url || '', ref: d.id })} style={{ marginBottom: 6 }} />
      </View>
    </Card>
  );
}

function SuggestDeal() {
  const { showToast } = useApp();
  const [name, setName] = useState('');
  const [offer, setOffer] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try { await api.suggestDeal({ name, offer }); setName(''); setOffer(''); showToast("Thanks! We'll check it and add it."); } catch (e) { showToast(e.message || "Couldn't send that"); }
    setBusy(false);
  };
  return (
    <PostIt color="yellow" tilt={-0.6} style={{ marginTop: 6 }}>
      <PT kind="bold">Know a student discount?</PT>
      <PT kind="small" style={{ marginBottom: 10 }}>Tell us. We check every one before it goes up.</PT>
      <Field placeholder="Place (e.g. a coffee shop near campus)" value={name} onChangeText={setName} style={{ marginBottom: 8 }} />
      <Field placeholder="The deal (e.g. 10% off with student ID)" value={offer} onChangeText={setOffer} style={{ marginBottom: 8 }} />
      <Button title="Send" small loading={busy} disabled={name.trim().length < 2 || offer.trim().length < 4} onPress={send} style={{ alignSelf: 'flex-start' }} />
    </PostIt>
  );
}

export function DealsSheet({ onClose }) {
  const live = useCallable(api.getDeals, {}, 'deals');
  const [cat, setCat] = useState('All');
  const deals = live.data || [];
  const cats = ['All', ...new Set(deals.map((d) => d.category).filter(Boolean))];
  const list = cat === 'All' ? deals : deals.filter((d) => d.category === cat);
  return (
    <Sheet title="Student deals" hand="Places near campus (and online) that take your student ID." onClose={onClose} height={0.92}>
      {live.loading ? <Loading label="Pinning up deals…" /> : null}
      {cats.length > 2 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>{cats.map((c) => <Chip key={c} label={c} active={cat === c} onPress={() => setCat(c)} />)}</View> : null}
      <View style={{ paddingTop: 8 }}>{list.map((d) => <DealCard key={d.id} d={d} />)}</View>
      {!live.loading && !deals.length ? <Empty icon="tag" title="No deals pinned up yet" body="We only list deals we've checked. Help us find the first ones:" /> : null}
      <SuggestDeal />
      <T kind="small" style={{ marginTop: 12, fontSize: 11.5 }}>Deals change. If one didn't work, tap Changed so we can re-check it.</T>
    </Sheet>
  );
}
