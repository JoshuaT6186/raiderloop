/**
 * Page scaffold for each tab: notebook background, a hand-lettered
 * header, and enough bottom padding to clear the tab bar and the
 * Pilot button (the old app's content hid behind the nav bar).
 */
import React from 'react';
import { View, ScrollView, SafeAreaView, Platform, RefreshControl, Animated, Pressable } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { PAD } from '../theme/tokens';
import { NotebookBg, T, Scribble } from './Paper';
import { SeasonDecor, PlaneOutfit } from './Scrap';
import Icon from './Icon';
import { PlaneMark } from './Logo';
import { tap } from '../lib/native';
import { FadeIn } from './Kit';
import { useWide } from './web';

export const BOTTOM_SPACE = 150;

/* paper: 'lined' (default) | 'graph' | 'dots' | 'kraft' | 'plain' */
export function Page({ title, eyebrow, right, children, refreshing, onRefresh, scroll = true, margin = true, paper = 'lined' }) {
  const { t } = useTheme();
  const wide = useWide();
  const showMargin = margin && paper === 'lined';
  const column = wide ? { width: '100%', maxWidth: 1040, alignSelf: 'center' } : null;
  const header = (
    <View>
      <SeasonDecor />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6 }}>
        <View style={{ flex: 1 }}>
          {eyebrow ? <T kind="hand" color={t.pencil}>{eyebrow}</T> : null}
          <T kind="marker" style={{ fontSize: title.length > 16 ? 28 : 34, lineHeight: title.length > 16 ? 34 : 40 }} numberOfLines={2}>{title}</T>
          <Scribble width={Math.min(200, 30 + title.length * 15)} style={{ marginTop: -8 }} />
        </View>
        {right}
      </View>
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <NotebookBg margin={showMargin} kind={paper} />
      <SafeAreaView style={{ flex: 1 }}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[{ paddingLeft: showMargin ? PAD + 22 : PAD, paddingRight: PAD, paddingTop: Platform.OS === 'android' ? 40 : wide ? 28 : 12, paddingBottom: wide ? 90 : BOTTOM_SPACE }, column]}
            showsVerticalScrollIndicator={false}
            refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.accent} /> : undefined}
            keyboardShouldPersistTaps="handled"
          >
            {header}
            <FadeIn>{children}</FadeIn>
          </ScrollView>
        ) : (
          <View style={[{ flex: 1, paddingTop: Platform.OS === 'android' ? 40 : wide ? 28 : 12 }, column]}>
            <View style={{ paddingLeft: showMargin ? PAD + 22 : PAD, paddingRight: PAD }}>{header}</View>
            {children}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const TABS = [
  { id: 'home', label: 'Home', icon: 'home', color: 'yellow' },
  { id: 'discover', label: 'Discover', icon: 'discover', color: 'pink' },
  { id: 'campus', label: 'Campus', icon: 'campus', color: 'green' },
  { id: 'schedule', label: 'Planner', icon: 'schedule', color: 'blue' },
  { id: 'you', label: 'You', icon: 'you', color: 'lavender' },
];

/* Notebook divider tabs: the active one is a raised colored tab. */
export function TabBar({ tab, setTab, badges = {} }) {
  const { t, f } = useTheme();
  return (
    <View style={{ position: 'absolute', left: 10, right: 10, bottom: Platform.OS === 'ios' ? 24 : 12, flexDirection: 'row', backgroundColor: t.tabBar, borderRadius: 18, borderWidth: 2, borderColor: t.mode === 'dark' ? t.borderStrong : '#1F2A44', paddingVertical: 6, paddingHorizontal: 4, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}>
      {TABS.map((x) => {
        const on = tab === x.id;
        return (
          <Pressable key={x.id} onPress={() => { tap(); setTab(x.id); }} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={x.label}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 6, marginHorizontal: 2, borderRadius: 12, backgroundColor: on ? t.postit[x.color] : 'transparent', transform: [{ translateY: on ? -3 : 0 }, { rotate: on ? '-1.5deg' : '0deg' }] }}>
            <Icon name={x.icon} size={22} color={on ? '#1F2A44' : t.pencil} stroke={on ? 2.4 : 2} />
            <T kind="small" style={{ fontSize: 11, fontFamily: f.bodyBold, marginTop: 1 }} color={on ? '#1F2A44' : t.pencil}>{x.label}</T>
            {badges[x.id] ? <View style={{ position: 'absolute', top: 4, right: 14, width: 8, height: 8, borderRadius: 4, backgroundColor: t.redPen }} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/* Floating Pilot button: a paper airplane that bobs gently, wearing
   whatever the season calls for. */
export function PilotFab({ onPress }) {
  const { t } = useTheme();
  const bob = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1600, useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 1600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={{ position: 'absolute', right: 16, bottom: Platform.OS === 'ios' ? 104 : 92, transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] }}>
      <Pressable onPress={() => { tap('medium'); onPress(); }} accessibilityRole="button" accessibilityLabel="Ask Pilot"
        style={({ pressed }) => ({ width: 62, height: 62, borderRadius: 31, backgroundColor: t.highlight, borderWidth: 2.5, borderColor: '#1F2A44', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8 })}>
        <PlaneMark size={40} trail={false} color="#1F2A44" />
      </Pressable>
      <PlaneOutfit size={26} style={{ top: -10, right: -4, transform: [{ rotate: '18deg' }] }} />
    </Animated.View>
  );
}

/* ---------- Web sidebar ----------
   On wide browser windows the bottom tabs become folder tabs down the
   left side, plus Flyer Drop, Present, Desk mode and the guide. */
export function WebSidebar({ tab, setTab, badges = {}, onDrop, onPresent, onDesk, onGuide, onAdmin, admin }) {
  const { t, f } = useTheme();
  const Item = ({ icon, label, onPress, active, color, badge }) => (
    <Pressable onPress={onPress} accessibilityRole={active != null ? 'tab' : 'button'} accessibilityState={active != null ? { selected: active } : undefined} accessibilityLabel={label}
      style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8, borderRadius: 12, borderTopRightRadius: active ? 0 : 12, borderBottomRightRadius: active ? 0 : 12, marginRight: active ? -2 : 10,
        borderWidth: active ? 2 : 1.5, borderRightWidth: active ? 0 : 1.5, borderColor: t.mode === 'dark' ? t.borderStrong : '#1F2A44', backgroundColor: active ? t.postit[color] : hovered ? t.card : 'transparent' })}>
      <Icon name={icon} size={20} color={active ? '#1F2A44' : t.ink} stroke={active ? 2.4 : 2} />
      <T kind="body" style={{ marginLeft: 10, fontFamily: active ? f.bodyBold : undefined }} color={active ? '#1F2A44' : t.ink}>{label}</T>
      {badge ? <View style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: 4, backgroundColor: t.redPen }} /> : null}
    </Pressable>
  );
  return (
    <View style={{ width: 236, paddingTop: 24, paddingLeft: 14, backgroundColor: t.mode === 'dark' ? t.card : '#F1E9D8', borderRightWidth: 1.5, borderRightColor: t.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 8, marginBottom: 18 }}>
        <PlaneMark size={34} trail={false} color={t.ink} />
        <T kind="marker" style={{ fontSize: 30, lineHeight: 36, marginLeft: 8 }}>Flyer</T>
      </View>
      {TABS.map((x) => <Item key={x.id} icon={x.icon} label={x.label} color={x.color} active={tab === x.id} badge={badges[x.id]} onPress={() => setTab(x.id)} />)}
      <View style={{ height: 1.5, backgroundColor: t.border, marginVertical: 12, marginRight: 14 }} />
      <Item icon="plane" label="Flyer Drop" onPress={onDrop} />
      <Item icon="tv" label="Present on a screen" onPress={onPresent} />
      <Item icon="laptop" label="Desk mode" onPress={onDesk} />
      <Item icon="book" label="Campus Guide" onPress={onGuide} />
      {admin ? <Item icon="shield" label="Admin" onPress={onAdmin} /> : null}
      <View style={{ marginTop: 'auto', padding: 12, paddingBottom: 22, paddingRight: 24 }}>
        <T kind="small" style={{ fontSize: 12 }}>Map, Apple Health, widgets and Wallet are in the iPhone app.</T>
      </View>
    </View>
  );
}
