/**
 * Paper UI kit
 * ------------------------------------------------------------
 * The whole app is built from these: a ruled notebook page, post-it
 * notes with tape, index cards, marker headings with a scribbled
 * underline, sticker chips, and a torn-edge bottom sheet. Texture is
 * used on surfaces and headers only; body text always sits on a flat
 * fill so it stays readable.
 */
import React, { useEffect, useRef } from 'react';
import {
  View, Text, Pressable, Modal, ScrollView, Animated, Easing, StyleSheet, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { SCREEN_W, SCREEN_H, PAD, shadow, tiltFor } from '../theme/tokens';
import { SvgLib, tap } from '../lib/native';
import Icon from './Icon';

/* ---------- Text ---------- */
export function T({ children, style, kind = 'body', color, numberOfLines, onPress, selectable }) {
  const { t, f } = useTheme();
  const base = {
    body: { fontFamily: f.body, fontSize: 15, lineHeight: 21, color: t.ink },
    small: { fontFamily: f.body, fontSize: 13, lineHeight: 18, color: t.inkSoft },
    tiny: { fontFamily: f.bodyBold, fontSize: 11, lineHeight: 14, color: t.pencil, letterSpacing: 0.6, textTransform: 'uppercase' },
    bold: { fontFamily: f.bodyBold, fontSize: 15, lineHeight: 21, color: t.ink, fontWeight: f.bodyBold ? undefined : '700' },
    title: { fontFamily: f.bodyHeavy, fontSize: 18, lineHeight: 23, color: t.ink, fontWeight: f.bodyHeavy ? undefined : '800' },
    hand: { fontFamily: f.hand, fontSize: 22, lineHeight: 25, color: t.inkSoft },
    handBig: { fontFamily: f.handBold, fontSize: 30, lineHeight: 32, color: t.ink },
    marker: { fontFamily: f.marker, fontSize: 30, lineHeight: 36, color: t.ink, fontWeight: f.marker ? undefined : '900' },
    num: { fontFamily: f.bodyHeavy, fontSize: 15, color: t.ink, fontVariant: ['tabular-nums'] },
  }[kind];
  return (
    <Text style={[base, color ? { color } : null, style]} numberOfLines={numberOfLines} onPress={onPress} selectable={selectable}>
      {children}
    </Text>
  );
}

/* ---------- Notebook page background ---------- */
export function NotebookBg({ lines = true, margin = true, style }) {
  const { t } = useTheme();
  const count = Math.ceil(SCREEN_H / 30) + 2;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.paper }, style]}>
      {lines ? Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: 96 + i * 30, height: 1, backgroundColor: t.rule }} />
      )) : null}
      {margin ? <View style={{ position: 'absolute', top: 0, bottom: 0, left: 30, width: 1.5, backgroundColor: t.margin }} /> : null}
      {/* hole punches */}
      {margin ? [0.22, 0.5, 0.78].map((p) => (
        <View key={p} style={{ position: 'absolute', left: 9, top: SCREEN_H * p, width: 12, height: 12, borderRadius: 6, backgroundColor: t.paperDeep, borderWidth: 1, borderColor: t.border }} />
      )) : null}
    </View>
  );
}

/* ---------- Tape ---------- */
export function Tape({ angle = -4, width = 64, style }) {
  const { t } = useTheme();
  return (
    <View pointerEvents="none" style={[{
      position: 'absolute', top: -9, alignSelf: 'center', width, height: 20, backgroundColor: t.tape,
      transform: [{ rotate: `${angle}deg` }], borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
    }, style]} />
  );
}

/* ---------- Post-it ---------- */
export function PostIt({
  color = 'yellow', tilt, seed, tape = false, fold = true, onPress, style, children, padding = 14, minHeight,
  accessibilityLabel,
}) {
  const { t } = useTheme();
  const bg = t.postit[color] || color;
  const angle = tilt != null ? tilt : seed != null ? tiltFor(seed, 1.4) : 0;
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  const body = (
    <Animated.View style={[{
      backgroundColor: bg, padding, minHeight, borderRadius: 3, borderBottomRightRadius: fold ? 14 : 3,
      transform: [{ rotate: `${angle}deg` }, { scale }],
    }, shadow(t, 1), style]}>
      {tape ? <Tape angle={-angle * 2 - 3} /> : null}
      {children}
      {fold ? (
        <View pointerEvents="none" style={{
          position: 'absolute', right: 0, bottom: 0, width: 16, height: 16, borderTopLeftRadius: 4, borderBottomRightRadius: 14,
          backgroundColor: 'rgba(0,0,0,0.07)',
        }} />
      ) : null}
    </Animated.View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={() => { tap(); onPress(); }} onPressIn={pressIn} onPressOut={pressOut} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      {body}
    </Pressable>
  );
}

/* Text helpers that are always dark-ink, for use ON post-its. */
export function PT({ children, kind = 'body', style, numberOfLines }) {
  const { t } = useTheme();
  const color = kind === 'small' || kind === 'tiny' ? t.postitInkSoft : t.postitInk;
  return <T kind={kind} color={color} style={style} numberOfLines={numberOfLines}>{children}</T>;
}

/* ---------- Index card (white, red header rule, blue lines) ---------- */
export function Card({ children, style, onPress, ruled = false, padding = 14, header }) {
  const { t } = useTheme();
  const inner = (
    <View style={[{ backgroundColor: t.card, borderRadius: 6, borderWidth: 1, borderColor: t.border, overflow: 'hidden' }, shadow(t, 0), style]}>
      {header !== false ? <View style={{ height: 3, backgroundColor: t.margin, opacity: 0.9 }} /> : null}
      {ruled ? Array.from({ length: 12 }).map((_, i) => (
        <View key={i} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 30 + i * 24, height: 1, backgroundColor: t.rule, opacity: 0.7 }} />
      )) : null}
      <View style={{ padding }}>{children}</View>
    </View>
  );
  if (!onPress) return inner;
  return <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>{inner}</Pressable>;
}

/* ---------- Scribble underline ---------- */
export function Scribble({ width = 120, color, style }) {
  const { t } = useTheme();
  if (!SvgLib) return <View style={[{ width, height: 3, backgroundColor: color || t.highlight }, style]} />;
  const { default: Svg, Path } = SvgLib;
  return (
    <Svg width={width} height={10} viewBox="0 0 120 10" preserveAspectRatio="none" style={style}>
      <Path d="M2 6 C 20 2, 40 9, 60 5 S 100 2, 118 6" stroke={color || t.highlight} strokeWidth={5} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/* ---------- Section header ---------- */
export function Section({ title, hand, action, onAction, style, icon }) {
  const { t } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 26, marginBottom: 12 }, style]}>
      <View style={{ flexShrink: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {icon ? <Icon name={icon} size={20} color={t.ink} style={{ marginRight: 6 }} /> : null}
          <T kind="handBig" style={{ fontSize: 28 }}>{title}</T>
        </View>
        <Scribble width={Math.min(150, 14 + title.length * 11)} style={{ marginTop: -4, marginLeft: icon ? 26 : 0 }} />
        {hand ? <T kind="small" style={{ marginTop: 2 }}>{hand}</T> : null}
      </View>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <T kind="hand" color={t.accent} style={{ fontSize: 20 }}>{action} →</T>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ---------- Buttons ---------- */
export function Button({ title, onPress, kind = 'primary', icon, disabled, loading, style, small }) {
  const { t, f } = useTheme();
  const styles = {
    primary: { bg: t.accent, fg: t.accentInk, border: t.accent },
    highlight: { bg: t.highlight, fg: '#1F2A44', border: '#1F2A44' },
    ghost: { bg: 'transparent', fg: t.ink, border: t.borderStrong },
    danger: { bg: 'transparent', fg: t.redPen, border: t.redPen },
  }[kind];
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={() => { tap(); onPress && onPress(); }}
      accessibilityRole="button"
      style={({ pressed }) => [{
        backgroundColor: styles.bg, borderColor: styles.border, borderWidth: 2, borderRadius: 14,
        paddingVertical: small ? 8 : 14, paddingHorizontal: small ? 14 : 20, flexDirection: 'row',
        alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        transform: [{ translateY: pressed ? 1 : 0 }],
        borderBottomWidth: kind === 'ghost' || kind === 'danger' ? 2 : 4,
      }, style]}
    >
      {loading ? <ActivityIndicator color={styles.fg} size="small" style={{ marginRight: 8 }} /> : icon ? <Icon name={icon} size={small ? 16 : 19} color={styles.fg} style={{ marginRight: 8 }} /> : null}
      <Text style={{ fontFamily: f.bodyHeavy, fontWeight: f.bodyHeavy ? undefined : '800', fontSize: small ? 14 : 16, color: styles.fg }}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ name, onPress, size = 22, color, style, label, badge }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={() => { tap(); onPress && onPress(); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: t.card, borderWidth: 1.5, borderColor: t.border, opacity: pressed ? 0.7 : 1 }, style]}>
      <Icon name={name} size={size} color={color || t.ink} />
      {badge ? <View style={{ position: 'absolute', top: 6, right: 7, width: 9, height: 9, borderRadius: 5, backgroundColor: t.redPen, borderWidth: 1.5, borderColor: t.card }} /> : null}
    </Pressable>
  );
}

/* ---------- Sticker chip ---------- */
export function Chip({ label, active, onPress, icon, color, style }) {
  const { t, f } = useTheme();
  const bg = active ? (color ? t.postit[color] : t.highlight) : t.card;
  return (
    <Pressable onPress={() => { tap(); onPress && onPress(); }} accessibilityRole="button" accessibilityState={{ selected: !!active }}
      style={[{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, marginRight: 8, marginBottom: 8, backgroundColor: bg, borderWidth: 1.5, borderColor: active ? '#1F2A44' : t.border }, style]}>
      {icon ? <Icon name={icon} size={15} color={active ? '#1F2A44' : t.inkSoft} style={{ marginRight: 5 }} /> : null}
      <Text style={{ fontFamily: f.bodyBold, fontWeight: f.bodyBold ? undefined : '700', fontSize: 13, color: active ? '#1F2A44' : t.inkSoft }}>{label}</Text>
    </Pressable>
  );
}

export function Highlight({ children, color, style }) {
  const { t } = useTheme();
  return (
    <View style={[{ alignSelf: 'flex-start' }, style]}>
      <View style={{ position: 'absolute', left: -3, right: -3, top: '45%', bottom: 0, backgroundColor: color || t.highlight, borderRadius: 3, transform: [{ rotate: '-1deg' }] }} />
      {children}
    </View>
  );
}

/* ---------- List row ---------- */
export function Row({ title, meta, left, right, onPress, chevron, note, style, last }) {
  const { t } = useTheme();
  const content = (
    <View style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderColor: t.rule, borderStyle: 'dashed' }, style]}>
      {left ? <View style={{ marginRight: 12 }}>{left}</View> : null}
      <View style={{ flex: 1 }}>
        <T kind="bold" numberOfLines={2}>{title}</T>
        {meta ? <T kind="small" numberOfLines={2} style={{ marginTop: 1 }}>{meta}</T> : null}
        {note ? <T kind="small" color={t.redPen} style={{ marginTop: 2 }}>{note}</T> : null}
      </View>
      {right}
      {onPress && (chevron !== false) ? <Icon name="chevronRight" size={18} color={t.faint} style={{ marginLeft: 6 }} /> : null}
    </View>
  );
  if (!onPress) return content;
  return <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })} accessibilityRole="button">{content}</Pressable>;
}

/* ---------- Checkbox (hand-drawn) ---------- */
export function Check({ checked, onPress, size = 24, label }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={() => { tap(checked ? 'light' : 'success'); onPress(); }} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label}
      style={{ width: size, height: size, borderRadius: 5, borderWidth: 2, borderColor: checked ? t.ok : 'rgba(31,42,68,0.5)', alignItems: 'center', justifyContent: 'center', backgroundColor: checked ? (t.mode === 'dark' ? 'rgba(143,214,168,0.15)' : '#E6F4EA') : 'transparent', transform: [{ rotate: '-2deg' }] }}>
      {checked ? <Icon name="check" size={size - 4} color={t.ok} stroke={2.8} /> : null}
    </Pressable>
  );
}

/* ---------- Toggle ---------- */
export function Toggle({ value, onChange, label }) {
  const { t } = useTheme();
  const x = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => { Animated.timing(x, { toValue: value ? 1 : 0, duration: 160, useNativeDriver: true }).start(); }, [value]);
  return (
    <Pressable onPress={() => { tap(); onChange(!value); }} accessibilityRole="switch" accessibilityState={{ checked: !!value }} accessibilityLabel={label} hitSlop={8}
      style={{ width: 50, height: 30, borderRadius: 15, borderWidth: 2, borderColor: value ? '#1F2A44' : t.borderStrong, backgroundColor: value ? t.highlight : t.paperDeep, justifyContent: 'center', paddingHorizontal: 2 }}>
      <Animated.View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: value ? '#1F2A44' : t.card, borderWidth: 1.5, borderColor: t.borderStrong, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }] }} />
    </Pressable>
  );
}

/* ---------- Input ---------- */
export function Field({ label, style, inputStyle, ...props }) {
  const { t, f } = useTheme();
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label ? <T kind="tiny" style={{ marginBottom: 6 }}>{label}</T> : null}
      <TextInput
        placeholderTextColor={t.faint}
        {...props}
        style={[{ fontFamily: f.body, fontSize: 16, color: t.ink, backgroundColor: t.card, borderWidth: 1.5, borderColor: t.borderStrong, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 }, inputStyle]}
      />
    </View>
  );
}

/* ---------- Torn-edge bottom sheet ---------- */
function TornEdge({ color }) {
  if (!SvgLib) return null;
  const { default: Svg, Path } = SvgLib;
  const w = SCREEN_W; const step = 12; let d = `M0 14 `;
  for (let x = 0; x <= w; x += step) d += `L${x} ${x / step % 2 ? 4 : 11} `;
  d += `L${w} 14 Z`;
  return <Svg width={w} height={14} style={{ marginBottom: -1 }}><Path d={d} fill={color} /></Svg>;
}

export function Sheet({ visible = true, onClose, title, hand, children, height = 0.86, scroll = true, footer, headerRight }) {
  const { t } = useTheme();
  const y = useRef(new Animated.Value(SCREEN_H)).current;
  useEffect(() => {
    if (visible) Animated.timing(y, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [visible]);
  const Body = scroll ? ScrollView : View;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(20,24,36,0.42)' }} onPress={onClose} accessibilityLabel="Close" />
        <Animated.View style={{ maxHeight: SCREEN_H * height, transform: [{ translateY: y }] }}>
          <TornEdge color={t.paper} />
          <View style={{ backgroundColor: t.paper, paddingBottom: 30 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: PAD, paddingTop: 6 }}>
              <View style={{ flex: 1 }}>
                {title ? <T kind="handBig">{title}</T> : null}
                {hand ? <T kind="small" style={{ marginTop: 2 }}>{hand}</T> : null}
              </View>
              {headerRight}
              <IconButton name="close" onPress={onClose} size={18} label="Close" style={{ width: 36, height: 36, marginLeft: 8 }} />
            </View>
            <Body
              style={scroll ? { maxHeight: SCREEN_H * height - 120 } : null}
              contentContainerStyle={scroll ? { paddingHorizontal: PAD, paddingTop: 10, paddingBottom: 16 } : null}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {scroll ? children : <View style={{ paddingHorizontal: PAD, paddingTop: 10 }}>{children}</View>}
            </Body>
            {footer ? <View style={{ paddingHorizontal: PAD, paddingTop: 8 }}>{footer}</View> : null}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---------- States ---------- */
export function Empty({ icon = 'sparkle', title, body, action, onAction }) {
  const { t } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 22, paddingHorizontal: 10 }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: t.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        <Icon name={icon} size={26} color={t.pencil} />
      </View>
      <T kind="hand" style={{ textAlign: 'center' }}>{title}</T>
      {body ? <T kind="small" style={{ textAlign: 'center', marginTop: 4 }}>{body}</T> : null}
      {action ? <Button title={action} onPress={onAction} kind="ghost" small style={{ marginTop: 12 }} /> : null}
    </View>
  );
}

export function Loading({ label = 'Loading…' }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}>
      <ActivityIndicator color={t.accent} />
      <T kind="hand" style={{ marginLeft: 10 }}>{label}</T>
    </View>
  );
}

export function Divider({ style }) {
  const { t } = useTheme();
  return <View style={[{ height: 1, borderTopWidth: 1.5, borderColor: t.border, borderStyle: 'dashed', marginVertical: 14 }, style]} />;
}

export function Stamp({ label, color, style }) {
  const { t, f } = useTheme();
  const c = color || t.redPen;
  return (
    <View style={[{ borderWidth: 2, borderColor: c, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2, transform: [{ rotate: '-4deg' }], alignSelf: 'flex-start' }, style]}>
      <Text style={{ fontFamily: f.bodyHeavy, fontWeight: f.bodyHeavy ? undefined : '800', fontSize: 10.5, letterSpacing: 1, color: c, textTransform: 'uppercase' }}>{label}</Text>
    </View>
  );
}

/* Small label for paid/affiliate/sponsored content — always visible. */
export function Disclosure({ label = 'Sponsored' }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(31,42,68,0.08)' }}>
      <Icon name="tag" size={11} color={t.postitInkSoft} style={{ marginRight: 3 }} />
      <Text style={{ fontSize: 10.5, fontWeight: '700', color: t.postitInkSoft, letterSpacing: 0.4 }}>{label.toUpperCase()}</Text>
    </View>
  );
}

export function Toast({ message }) {
  if (!message) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 120, alignItems: 'center' }}>
      <PostIt color="yellow" tilt={-1.5} fold={false} padding={12}>
        <PT kind="bold">{message}</PT>
      </PostIt>
    </View>
  );
}
