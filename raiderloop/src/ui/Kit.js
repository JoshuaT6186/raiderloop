/**
 * More paper-kit pieces for Flyer 2, in the same pen-and-paper style:
 *   FolderTabs   notebook divider tabs (Planner, Discover lanes, You)
 *   Highlighter  a marker swipe that draws itself under a word
 *   RubberStamp  round ink stamps for Flight Score
 *   FadeIn       a soft slide-up when a page or card appears
 *   PlaneFlight  the paper plane flying across (Flyer Drop, sending)
 *   QRCode       a scannable QR drawn as SVG
 *   PersonRow    avatar + name row used by Connect screens
 * All motion holds still when the phone's Reduce Motion is on.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { View, Pressable, Animated, Easing, Text, ScrollView } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { SCREEN_W, SCREEN_H } from '../theme/tokens';
import { SvgLib, tap } from '../lib/native';
import { useReduceMotion } from '../lib/motion';
import { qrMatrix, qrRuns } from '../lib/qr';
import { T, Chip } from './Paper';
import { relDayLabel } from '../lib/time';
import Icon from './Icon';
import { PlaneMark } from './Logo';
import Avatar from './Avatar';

const INK = '#1F2A44';

/* ---------- Folder tabs ---------- */
export function FolderTabs({ tabs, value, onChange, style, small }) {
  const { t, f } = useTheme();
  return (
    <View accessibilityRole="tablist" style={[{ flexDirection: 'row', marginTop: 12, marginBottom: 10 }, style]}>
      {tabs.map((x) => {
        const on = value === x.id;
        return (
          <Pressable key={x.id} onPress={() => { tap(); onChange(x.id); }} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={x.label}
            style={{
              flex: 1, alignItems: 'center', paddingVertical: small ? 6 : 8, marginHorizontal: 3, borderTopLeftRadius: 10, borderTopRightRadius: 10,
              borderWidth: 1.5, borderBottomWidth: on ? 0 : 1.5, borderColor: on ? INK : t.border, backgroundColor: on ? t.postit[x.color || 'yellow'] : t.card,
              transform: [{ translateY: on ? -3 : 0 }],
            }}>
            {x.icon ? <Icon name={x.icon} size={small ? 16 : 18} color={on ? INK : t.pencil} /> : null}
            <Text numberOfLines={1} style={{ fontFamily: f.bodyBold, fontWeight: f.bodyBold ? undefined : '700', fontSize: small ? 11.5 : 12, color: on ? INK : t.pencil }}>{x.label}</Text>
            {x.badge ? <View style={{ position: 'absolute', top: 5, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: t.redPen }} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/* ---------- Highlighter swipe ---------- */
export function Highlighter({ children, color, style, delay = 120 }) {
  const { t } = useTheme();
  const reduce = useReduceMotion();
  const w = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) { w.setValue(1); return; }
    Animated.timing(w, { toValue: 1, duration: 520, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [reduce]);
  return (
    <View style={[{ alignSelf: 'flex-start' }, style]}>
      <Animated.View pointerEvents="none" style={{
        position: 'absolute', left: -4, top: '42%', bottom: -1, borderRadius: 3, backgroundColor: color || t.highlight, opacity: 0.85,
        width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '104%'] }), transform: [{ rotate: '-1.2deg' }],
      }} />
      {children}
    </View>
  );
}

/* ---------- Rubber stamp (Flight Score) ---------- */
export function RubberStamp({ label, sub, color, size = 74, tilt = -8, faded, onPress }) {
  const { f } = useTheme();
  const c = color || '#C8413B';
  const body = (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: c, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: `${tilt}deg` }], opacity: faded ? 0.28 : 0.92 }}>
      <View style={{ position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderRadius: size / 2, borderWidth: 1.2, borderColor: c, borderStyle: 'dashed' }} />
      <Text numberOfLines={2} style={{ fontFamily: f.bodyHeavy, fontWeight: f.bodyHeavy ? undefined : '800', color: c, fontSize: size * 0.15, textAlign: 'center', letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 8 }}>{label}</Text>
      {sub ? <Text style={{ fontFamily: f.bodyBold, color: c, fontSize: size * 0.12, marginTop: 1 }}>{sub}</Text> : null}
    </View>
  );
  if (!onPress) return body;
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>{body}</Pressable>;
}

/* A stamp that thunks down when it first appears (earned just now). */
export function StampThunk({ children, play }) {
  const reduce = useReduceMotion();
  const s = useRef(new Animated.Value(play && !reduce ? 1.8 : 1)).current;
  const o = useRef(new Animated.Value(play && !reduce ? 0 : 1)).current;
  useEffect(() => {
    if (!play || reduce) return;
    Animated.parallel([
      Animated.spring(s, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
      Animated.timing(o, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
  }, [play, reduce]);
  return <Animated.View style={{ transform: [{ scale: s }], opacity: o }}>{children}</Animated.View>;
}

/* ---------- Fade in ---------- */
export function FadeIn({ children, delay = 0, style }) {
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) { v.setValue(1); return; }
    Animated.timing(v, { toValue: 1, duration: 320, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [reduce]);
  return (
    <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

/* ---------- Paper plane flight ----------
   direction 'out' flies up and away (you sent something); 'in' swoops
   in from the top and lands (something arrived). Calls onDone after. */
export function PlaneFlight({ direction = 'out', onDone, label }) {
  const reduce = useReduceMotion();
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) { const id = setTimeout(() => onDone && onDone(), 700); return () => clearTimeout(id); }
    Animated.sequence([
      Animated.timing(p, { toValue: 1, duration: 1150, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.delay(150),
    ]).start(() => onDone && onDone());
    return undefined;
  }, []);
  const out = direction === 'out';
  const tx = p.interpolate({ inputRange: [0, 0.5, 1], outputRange: out ? [0, SCREEN_W * 0.15, SCREEN_W * 0.75] : [-SCREEN_W * 0.7, -SCREEN_W * 0.1, 0] });
  const ty = p.interpolate({ inputRange: [0, 0.5, 1], outputRange: out ? [0, -SCREEN_H * 0.12, -SCREEN_H * 0.55] : [-SCREEN_H * 0.45, -SCREEN_H * 0.1, 0] });
  const rot = p.interpolate({ inputRange: [0, 1], outputRange: out ? ['-8deg', '-28deg'] : ['18deg', '0deg'] });
  const sc = p.interpolate({ inputRange: [0, 0.7, 1], outputRange: out ? [1, 0.9, 0.5] : [0.5, 1.1, 1] });
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ transform: reduce ? [] : [{ translateX: tx }, { translateY: ty }, { rotate: rot }, { scale: sc }] }}>
        <PlaneMark size={110} trail color={INK} />
      </Animated.View>
      {label ? <T kind="handBig" style={{ marginTop: 18 }}>{label}</T> : null}
    </View>
  );
}

/* ---------- QR code ---------- */
export function QRCode({ value, size = 200, color = INK, bg = '#FFFFFF', style }) {
  const runs = useMemo(() => {
    try { const m = qrMatrix(value); return { n: m.length, runs: qrRuns(m) }; } catch (e) { return null; }
  }, [value]);
  if (!runs || !SvgLib) {
    return <View style={[{ width: size, height: size, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, style]}><T kind="small" color={INK}>QR unavailable</T></View>;
  }
  const { default: Svg, Rect } = SvgLib;
  const quiet = 2; const dim = runs.n + quiet * 2;
  return (
    <View style={[{ backgroundColor: bg, padding: 6, borderRadius: 8 }, style]} accessible accessibilityLabel="QR code">
      <Svg width={size} height={size} viewBox={`0 0 ${dim} ${dim}`}>
        <Rect x={0} y={0} width={dim} height={dim} fill={bg} />
        {runs.runs.map((r) => <Rect key={`${r.x}-${r.y}`} x={r.x + quiet} y={r.y + quiet} width={r.w} height={1.02} fill={color} />)}
      </Svg>
    </View>
  );
}

/* ---------- Person row ---------- */
export function PersonRow({ person, meta, right, onPress, last, size = 42 }) {
  const { t } = useTheme();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderColor: t.rule, borderStyle: 'dashed' }}>
      <Avatar config={person.avatar || {}} size={size} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <T kind="bold" numberOfLines={1}>{person.name || 'Someone'}</T>
        {meta ? <T kind="small" numberOfLines={2}>{meta}</T> : null}
      </View>
      {right}
    </View>
  );
  if (!onPress) return body;
  return <Pressable onPress={() => { tap(); onPress(); }} accessibilityRole="button">{body}</Pressable>;
}

/* ---------- Little helpers ---------- */
export function Pill({ label, color, icon, style }) {
  const { t, f } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: color ? t.postit[color] : t.card, borderWidth: 1.2, borderColor: color ? INK : t.border, marginRight: 6, marginTop: 4 }, style]}>
      {icon ? <Icon name={icon} size={12} color={color ? INK : t.inkSoft} style={{ marginRight: 4 }} /> : null}
      <Text style={{ fontFamily: f.bodyBold, fontSize: 11.5, color: color ? INK : t.inkSoft }}>{label}</Text>
    </View>
  );
}

export function SectionNote({ children, icon = 'info', onPress }) {
  const { t } = useTheme();
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
      <Icon name={icon} size={15} color={t.pencil} style={{ marginTop: 2, marginRight: 6 }} />
      <T kind="small" style={{ flex: 1, textDecorationLine: onPress ? 'underline' : 'none' }}>{children}</T>
    </Wrap>
  );
}

/* ---------- When picker (day chips + time chips) ---------- */
export const TIMES = [
  { label: '8 AM', h: 8, m: 0 }, { label: '9 AM', h: 9, m: 0 }, { label: '10 AM', h: 10, m: 0 }, { label: '11 AM', h: 11, m: 0 },
  { label: 'Noon', h: 12, m: 0 }, { label: '1 PM', h: 13, m: 0 }, { label: '2 PM', h: 14, m: 0 }, { label: '3 PM', h: 15, m: 0 },
  { label: '4 PM', h: 16, m: 0 }, { label: '5 PM', h: 17, m: 0 }, { label: '6 PM', h: 18, m: 0 }, { label: '7 PM', h: 19, m: 0 },
  { label: '8 PM', h: 20, m: 0 }, { label: '9 PM', h: 21, m: 0 }, { label: '10 PM', h: 22, m: 0 }, { label: '11:59 PM', h: 23, m: 59 },
];
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/** value/onChange are ISO strings. */
export function WhenPicker({ value, onChange, days = 30, withTime = true, times = TIMES, defaultTime = 'Noon', label = 'Day' }) {
  const now = new Date();
  const cur = value ? new Date(value) : null;
  const offset = cur ? Math.round((startOfDay(cur) - startOfDay(now)) / 86400000) : null;
  const tIdx = cur ? times.findIndex((x) => x.h === cur.getHours() && x.m === cur.getMinutes()) : -1;
  const make = (dayOff, ti) => {
    const d = startOfDay(now); d.setDate(d.getDate() + dayOff);
    const tm = times[ti >= 0 ? ti : Math.max(0, times.findIndex((x) => x.label === defaultTime))] || times[0];
    d.setHours(withTime ? tm.h : 23, withTime ? tm.m : 59, 0, 0);
    onChange(d.toISOString());
  };
  return (
    <View style={{ marginBottom: 10 }}>
      <T kind="tiny" style={{ marginBottom: 6 }}>{label}</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {Array.from({ length: days }, (_, i) => {
          const d = startOfDay(now); d.setDate(d.getDate() + i);
          return <Chip key={i} label={i < 2 ? relDayLabel(d) : d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })} active={offset === i} onPress={() => make(i, tIdx)} />;
        })}
      </ScrollView>
      {withTime ? (
        <>
          <T kind="tiny" style={{ marginTop: 6, marginBottom: 6 }}>Time</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {times.map((x, i) => <Chip key={x.label} label={x.label} color="blue" active={tIdx === i} onPress={() => make(offset != null ? offset : 0, i)} />)}
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}
