import React, { useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../../state/AppContext';
import { useTheme } from '../../theme/ThemeContext';
import { T, PostIt, PT, Button, Field, Card, Sheet, Stamp } from '../../ui/Paper';
import Icon from '../../ui/Icon';
import { Shell, Heading } from './Shell';
import { SCHOOLS, COMING_SOON_NOTE } from '../../config';
import { api } from '../../lib/firebase';

export function RequestSchool({ onClose }) {
  const { t } = useTheme();
  const [school, setSchool] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle');
  const send = async () => {
    setState('sending');
    try { await api.requestSchool({ school: school.trim(), email: email.trim() || null }); setState('sent'); } catch (e) { setState('error'); }
  };
  return (
    <Sheet title="Request your school" hand="The most-requested campuses get built first." onClose={onClose} height={0.7}
      footer={state === 'sent' ? <Button title="Done" onPress={onClose} /> : (
        <Button title="Send request" icon="send" loading={state === 'sending'} disabled={school.trim().length < 3} onPress={send} />
      )}>
      {state === 'sent' ? (
        <PostIt color="green" tilt={-1.5} tape>
          <PT kind="title">Got it — thanks!</PT>
          <PT kind="small">We'll count your vote for {school}. {email ? "We'll email you if it launches." : ''}</PT>
        </PostIt>
      ) : (
        <>
          <Field label="School name" placeholder="e.g. University of North Texas" value={school} onChangeText={setSchool} autoCapitalize="words" />
          <Field label="Email (optional)" placeholder="So we can tell you when it's live" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          {state === 'error' ? <T kind="small" color={t.redPen}>Couldn't send that — check your connection and try again.</T> : null}
        </>
      )}
    </Sheet>
  );
}

export default function School() {
  const { t } = useTheme();
  const { set, schoolId } = useApp();
  const [picked, setPicked] = useState(schoolId || null);
  const [requesting, setRequesting] = useState(false);
  return (
    <Shell step="school" onBack={() => set({ onboardStep: 'account' })}
      footer={<Button title="Continue" icon="chevronRight" disabled={!picked} onPress={() => set({ schoolId: picked, onboardStep: 'profile' })} />}>
      <Heading eyebrow="step two" title="Pick your school" sub="Flyer loads that campus's real buildings, dining, and clubs." />
      {SCHOOLS.filter((s) => s.active).map((s, i) => (
        <PostIt key={s.id} color={picked === s.id ? 'yellow' : 'blue'} seed={s.id} tape={picked === s.id} onPress={() => setPicked(s.id)} style={{ marginBottom: 14 }} accessibilityLabel={s.name}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <PT kind="title">{s.name}</PT>
              <PT kind="small">{s.city}</PT>
            </View>
            {picked === s.id ? <Icon name="check" size={26} color="#2E8256" stroke={3} /> : <Icon name="globe" color="#4B5571" />}
          </View>
        </PostIt>
      ))}
      <Card style={{ marginTop: 6 }}>
        <Stamp label="Coming soon" color={t.accent} />
        <T kind="body" style={{ marginTop: 8 }}>{COMING_SOON_NOTE}</T>
        <Button title="Request your school" kind="ghost" icon="flag" small onPress={() => setRequesting(true)} style={{ marginTop: 12, alignSelf: 'flex-start' }} />
      </Card>
      {requesting ? <RequestSchool onClose={() => setRequesting(false)} /> : null}
    </Shell>
  );
}
