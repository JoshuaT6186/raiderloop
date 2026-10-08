import React, { useRef, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useApp } from '../../state/AppContext';
import { useTheme } from '../../theme/ThemeContext';
import { SCREEN_W, PAD } from '../../theme/tokens';
import { T, PostIt, PT, Button } from '../../ui/Paper';
import Icon from '../../ui/Icon';
import Avatar from '../../ui/Avatar';
import { PlaneMark } from '../../ui/Logo';
import { Shell } from './Shell';

const SLIDES = [
  { color: 'blue', icon: 'plane', title: 'Meet Pilot', body: "Tap the paper airplane anywhere to ask about campus: what's open, where your class is, deadlines. It looks things up live when it needs to." },
  { color: 'yellow', icon: 'clipboard', title: 'Never miss a due date', body: 'Add assignments, track your GPA, see your finals countdown, and export your whole week to your calendar in one tap.' },
  { color: 'green', icon: 'campus', title: "What's open near you", body: 'Dining, study spots, parking, floor plans and the campus police number. All one tap away.' },
  { color: 'pink', icon: 'users', title: 'Find your people', body: 'Add friends, see who shares your classes (if they opt in), and share where you are with only the friends you pick, like at a game.' },
];

export default function Tour() {
  const { t } = useTheme();
  const { set, avatar, userName } = useApp();
  const [i, setI] = useState(0);
  const ref = useRef(null);
  const w = SCREEN_W - PAD * 2 - 22;
  const finish = () => set({ onboarded: true, onboardStep: 'welcome' });
  const go = (n) => { setI(n); ref.current?.scrollTo({ x: n * w, animated: true }); };
  return (
    <Shell step="tour" scroll={false} onBack={() => set({ onboardStep: 'permissions' })}
      footer={(
        <View>
          <Button title={i === SLIDES.length - 1 ? 'Take off' : 'Next'} icon={i === SLIDES.length - 1 ? 'plane' : 'chevronRight'} onPress={() => (i === SLIDES.length - 1 ? finish() : go(i + 1))} />
          <Pressable onPress={finish} style={{ alignItems: 'center', marginTop: 12 }}><T kind="hand" color={t.pencil}>skip tour</T></Pressable>
        </View>
      )}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
        <Avatar config={avatar} size={52} />
        <View style={{ marginLeft: 12 }}>
          <T kind="hand">you're all set,</T>
          <T kind="marker" style={{ fontSize: 26, lineHeight: 30 }}>{userName || 'friend'}!</T>
        </View>
      </View>
      <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ marginTop: 26, flexGrow: 0 }}
        onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / w))}>
        {SLIDES.map((s, idx) => (
          <View key={s.title} style={{ width: w, paddingVertical: 12, paddingRight: 8 }}>
            <PostIt color={s.color} seed={s.title} tape padding={22} minHeight={260}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                {s.icon === 'plane' ? <PlaneMark size={44} trail={false} /> : <Icon name={s.icon} size={28} color="#1F2A44" />}
              </View>
              <PT kind="title" style={{ fontSize: 22, lineHeight: 27 }}>{s.title}</PT>
              <PT kind="body" style={{ marginTop: 8 }}>{s.body}</PT>
            </PostIt>
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 8 }}>
        {SLIDES.map((s, idx) => <View key={s.title} style={{ width: 8, height: 8, borderRadius: 4, marginHorizontal: 4, backgroundColor: idx === i ? t.accent : t.border }} />)}
      </View>
    </Shell>
  );
}
