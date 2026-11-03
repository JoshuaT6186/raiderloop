import React, { useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../../state/AppContext';
import { useTheme } from '../../theme/ThemeContext';
import { T, Button, Field, Chip, Card } from '../../ui/Paper';
import Icon from '../../ui/Icon';
import { Shell, Heading } from './Shell';
import { CLASS_YEARS } from '../../data/majors';
import MajorPicker from '../../sheets/MajorPicker';

export default function Profile() {
  const { t } = useTheme();
  const { set, userName, userMajor, userClassYear } = useApp();
  const [name, setName] = useState(userName);
  const [major, setMajor] = useState(userMajor);
  const [year, setYear] = useState(userClassYear);
  const [picking, setPicking] = useState(false);
  return (
    <Shell step="profile" onBack={() => set({ onboardStep: 'school' })}
      footer={<Button title="Continue" icon="chevronRight" disabled={!name.trim()} onPress={() => set({ userName: name.trim(), userMajor: major, userClassYear: year, onboardStep: 'avatar' })} />}>
      <Heading eyebrow="step three" title="A little about you" sub="Used to tailor what you see. Your major and year stay on your phone." />
      <Field label="What should we call you?" placeholder="First name" value={name} onChangeText={setName} autoCapitalize="words" />
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
