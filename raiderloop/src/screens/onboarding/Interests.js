import React, { useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../../state/AppContext';
import { PostIt, PT, Button } from '../../ui/Paper';
import Icon from '../../ui/Icon';
import { Shell, Heading } from './Shell';
import { INTERESTS } from '../../data/campus';
import { POSTIT_KEYS, SCREEN_W, PAD } from '../../theme/tokens';

export default function Interests() {
  const { set, interests } = useApp();
  const [picked, setPicked] = useState(interests);
  const toggle = (i) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  const w = (SCREEN_W - PAD * 2 - 22 - 12) / 2;
  return (
    <Shell step="interests" onBack={() => set({ onboardStep: 'avatar' })}
      footer={<Button title={picked.length ? `Continue with ${picked.length}` : 'Skip for now'} kind={picked.length ? 'primary' : 'ghost'} icon="chevronRight" onPress={() => set({ interests: picked, onboardStep: 'schedule' })} />}>
      <Heading eyebrow="step five" title="What are you into?" sub="We'll float matching clubs and events to the top." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {INTERESTS.map((i, idx) => {
          const on = picked.includes(i);
          return (
            <View key={i} style={{ width: w, marginBottom: 12 }}>
              <PostIt color={on ? POSTIT_KEYS[idx % POSTIT_KEYS.length] : 'blue'} seed={i} onPress={() => toggle(i)} padding={12} minHeight={74}
                style={{ opacity: on ? 1 : 0.55, borderWidth: on ? 2 : 0, borderColor: '#1F2A44' }} accessibilityLabel={i}>
                <Icon name={i} color="#1F2A44" size={22} />
                <PT kind="bold" style={{ marginTop: 6 }}>{i}</PT>
                {on ? <View style={{ position: 'absolute', top: 8, right: 8 }}><Icon name="check" size={18} color="#2E8256" stroke={3} /></View> : null}
              </PostIt>
            </View>
          );
        })}
      </View>
    </Shell>
  );
}
