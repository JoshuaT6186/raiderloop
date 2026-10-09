import React, { useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../../state/AppContext';
import { useTheme } from '../../theme/ThemeContext';
import { T, Button, Field, Chip, Card } from '../../ui/Paper';
import Icon from '../../ui/Icon';
import { Shell, Heading } from './Shell';
import { CLASS_YEARS } from '../../data/majors';
import MajorPicker from '../../sheets/MajorPicker';
import { nameProblem } from '../../lib/firebase';

export default function Profile() {
  const { t } = useTheme();
  const { set, userName, userMajor, userClassYear } = useApp();
  const [name, setName] = useState(userName);
  const [major, setMajor] = useState(userMajor);
  const [year, setYear] = useState(userClassYear);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const go = async () => {
    setBusy(true); setError(null);
    const problem = await nameProblem(name);
    setBusy(false);
    if (problem) { setError(problem); return; }
    set({ userName: name.trim().replace(/\s+/g, ' '), userMajor: major, userClassYear: year, onboardStep: 'avatar' });
  };
  return (
    <Shell step="profile" onBack={() => set({ onboardStep: 'school' })}
      footer={<Button title="Continue" icon="chevronRight" loading={busy} disabled={!name.trim()} onPress={go} />}>
      <Heading eyebrow="step three" title="A little about you" sub="Used to tailor what you see. Your major and year stay on your phone." />
      <Field label="What should we call you?" placeholder="First name" value={name} onChangeText={(v) => { setName(v); setError(null); }} autoCapitalize="words" maxLength={40} />
      {error ? <T kind="small" color={t.redPen} style={{ marginBottom: 8 }}>{error}</T> : null}
      <T kind="tiny" style={{ marginBottom: 6 }}>Year</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
        {CLASS_YEARS.map((y) => <Chip key={y} label={y} active={year === y} onPress={() => setYear(y)} />)}
      </View>
      <T kind="tiny" style={{ marginBottom: 6 }}>Major</T>
      <Card onPress={() => setPicking(true)}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="cap" color={t.inkSoft} />
          <T kind={major ? 'bold' : 'body'} color={major ? t.ink : t.faint} style={{ flex: 1, marginLeft: 10 }}>{major || 'Pick your major'}</T>
          <Icon name="chevronDown" color={t.faint} />
        </View>
      </Card>
      {picking ? <MajorPicker value={major} onClose={() => setPicking(false)} onSelect={(m) => { setMajor(m); setPicking(false); }} /> : null}
    </Shell>
  );
}
