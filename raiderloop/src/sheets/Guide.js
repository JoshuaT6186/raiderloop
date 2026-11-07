/**
 * Campus Guide: a public, no-account look at Texas Tech and Lubbock.
 * Opens from the book icon on Home, from the Campus hub, and from the
 * first onboarding screen ("Just looking?"), so anyone who downloads
 * Flyer, student or not, gets something real right away.
 */
import React from 'react';
import { View, Pressable } from 'react-native';
import { Sheet, T, PostIt, PT, Card, Row, Section } from '../ui/Paper';
import { SectionNote } from '../ui/Kit';
import Icon from '../ui/Icon';
import { useTheme } from '../theme/ThemeContext';
import { openUrl } from '../lib/links';
import { GUIDE, GUIDE_CHECKED } from '../data/guide';

const checkedLabel = new Date(`${GUIDE_CHECKED}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function CampusGuideSheet({ onClose }) {
  const { t } = useTheme();
  const g = GUIDE;
  return (
    <Sheet title="Campus Guide" hand={`${g.school} · ${g.city}`} onClose={onClose} height={0.96}>
      <PostIt color="yellow" tape tilt={-1}>
        <PT kind="tiny">At a glance</PT>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
          {g.glance.map((x) => (
            <Pressable key={x.label} disabled={!x.source} onPress={() => openUrl(x.source)} style={{ width: '50%', paddingRight: 8, marginBottom: 10 }}>
              <PT kind="title" style={{ fontSize: 22, lineHeight: 26 }}>{x.value}</PT>
              <PT kind="small" style={{ fontSize: 12 }}>{x.label}</PT>
              {x.note ? <PT kind="small" style={{ fontSize: 11 }}>{x.note}</PT> : null}
            </Pressable>
          ))}
        </View>
      </PostIt>

      <Section title="Getting in" icon="cap" />
      <T kind="body">{g.admissions.intro}</T>
      <Card style={{ marginTop: 10 }}>
        {g.admissions.table.map((r, i) => <Row key={r.rank} title={r.rank} meta={r.score} last={i === g.admissions.table.length - 1} />)}
      </Card>
      {g.admissions.notes.map((n) => <T key={n} kind="small" style={{ marginTop: 6 }}>• {n}</T>)}
      <T kind="small" color={t.accent} style={{ marginTop: 8 }} onPress={() => openUrl(g.admissions.source)}>Source: TTU Undergraduate Admissions (checked {checkedLabel})</T>

      <Section title="What to study" icon="book" />
      <T kind="body">{g.study.intro}</T>
      <Card style={{ marginTop: 10 }}>
        {g.study.known.map((k, i) => <Row key={k.name} title={k.name} meta={k.why} last={i === g.study.known.length - 1} />)}
      </Card>
      <T kind="small" style={{ marginTop: 6 }}>{g.study.tip}</T>

      <Section title="Traditions" icon="flag" />
      {g.traditions.map((x, i) => (
        <PostIt key={x.name} color={['pink', 'blue', 'green', 'lavender', 'orange', 'yellow'][i % 6]} seed={x.name} style={{ marginBottom: 10 }} padding={12}>
          <PT kind="bold">{x.name}</PT>
          <PT kind="small" style={{ marginTop: 2 }}>{x.what}</PT>
        </PostIt>
      ))}

      <Section title="Notable Red Raiders" icon="star" />
      <Card>
        {g.alumni.map((a, i) => <Row key={a.name} title={a.name} meta={a.what} last={i === g.alumni.length - 1} />)}
      </Card>

      <Section title="Life in Lubbock" icon="map" />
      <T kind="body">{g.lubbock.intro}</T>
      <Card style={{ marginTop: 10 }}>
        {g.lubbock.things.map((x, i) => <Row key={x.name} title={x.name} meta={x.what} left={<Icon name="discover" color={t.ink} />} last={i === g.lubbock.things.length - 1} />)}
      </Card>
      <T kind="small" style={{ marginTop: 6 }}>These are pinned in purple on the Campus map.</T>

      <Section title="Learn more" icon="link" />
      <Card>
        {g.links.map((l, i) => <Row key={l.url} title={l.label} left={<Icon name="link" color={t.ink} />} onPress={() => openUrl(l.url)} chevron last={i === g.links.length - 1} />)}
      </Card>
      <SectionNote icon="info">{g.disclaimer}</SectionNote>
    </Sheet>
  );
}
