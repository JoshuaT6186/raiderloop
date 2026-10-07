import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, SafeAreaView } from 'react-native';
import { useApp } from '../../state/AppContext';
import { useTheme } from '../../theme/ThemeContext';
import { PAD, SCREEN_W } from '../../theme/tokens';
import { T, NotebookBg, PostIt, PT, Button, Scribble } from '../../ui/Paper';
import { PlaneMark } from '../../ui/Logo';
import { APP } from '../../config';

/* The paper airplane glides in along a gentle arc, then the notes
   drop onto the page one by one. */
export default function Welcome() {
  const { t } = useTheme();
  const { set } = useApp();
  const fly = useRef(new Animated.Value(0)).current;
  const notes = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fly, { toValue: 1, duration: 1300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.stagger(140, notes.map((n) => Animated.spring(n, { toValue: 1, useNativeDriver: true, friction: 6 }))),
    ]).start();
  }, []);

  const tx = fly.interpolate({ inputRange: [0, 1], outputRange: [-SCREEN_W * 0.7, 0] });
  const ty = fly.interpolate({ inputRange: [0, 0.5, 1], outputRange: [140, -30, 0] });
  const rot = fly.interpolate({ inputRange: [0, 0.6, 1], outputRange: ['-25deg', '8deg', '0deg'] });

  const bullets = [
    { color: 'yellow', text: 'Your classes, with a heads-up before each one' },
    { color: 'pink', text: "What's open, what's on, and who's around" },
    { color: 'blue', text: 'Pilot answers campus questions in seconds' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <NotebookBg />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingLeft: PAD + 22, paddingRight: PAD, justifyContent: 'center' }}>
          <Animated.View style={{ transform: [{ translateX: tx }, { translateY: ty }, { rotate: rot }], alignSelf: 'flex-start' }}>
            <PlaneMark size={96} />
          </Animated.View>
          <T kind="marker" style={{ fontSize: 58, lineHeight: 66, marginTop: 8 }}>Flyer</T>
          <Scribble width={150} style={{ marginTop: -10 }} />
          <T kind="hand" style={{ fontSize: 26, marginTop: 10 }}>{APP.tagline}</T>

          <View style={{ marginTop: 28 }}>
            {bullets.map((b, i) => (
              <Animated.View key={b.text} style={{ opacity: notes[i], transform: [{ translateY: notes[i].interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }], marginBottom: 12 }}>
                <PostIt color={b.color} seed={b.text} padding={12} fold={false}>
                  <PT kind="bold">{b.text}</PT>
                </PostIt>
              </Animated.View>
            ))}
          </View>
        </View>
        <View style={{ paddingLeft: PAD + 22, paddingRight: PAD, paddingBottom: 14 }}>
          <Button title="Let's fly" icon="plane" onPress={() => set({ onboardStep: 'account' })} />
          <T kind="small" style={{ textAlign: 'center', marginTop: 12, fontSize: 11.5 }}>{APP.disclaimer}</T>
        </View>
      </SafeAreaView>
    </View>
  );
}
