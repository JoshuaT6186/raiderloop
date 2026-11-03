/**
 * Scrapbook bits that add variety to the paper kit without changing
 * it: washi tape with patterns, polaroids, push pins, paper clips,
 * and the seasonal decorations (a hand-drawn band at the top of a
 * page, plus an outfit for the paper plane).
 *
 * Everything here is decoration only: pointerEvents are off, screen
 * readers skip it, and motion stops when Reduce Motion is on.
 */
import React, { useEffect, useRef } from 'react';
import { View, Image, Pressable, Animated, Easing } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { shadow, tiltFor } from '../theme/tokens';
import { SvgLib, tap } from '../lib/native';
import { useReduceMotion } from '../lib/motion';
import { T } from './Paper';
import Icon from './Icon';

const INK = '#1F2A44';

/* ---------- Washi tape ---------- */
function WashiPattern({ pattern, width, height }) {
  if (!SvgLib) return null;
  const { default: Svg, Path, Circle } = SvgLib;
  const w = 'rgba(255,255,255,0.6)';
  const marks = [];
  if (pattern === 'stripes') {
    let d = '';
    for (let x = -height; x < width + height; x += 9) d += `M${x} ${height} L${x + height} 0 `;
    marks.push(<Path key="s" d={d} stroke={w} strokeWidth={3.5} />);
  } else if (pattern === 'grid') {
    let d = '';
    for (let x = 3; x < width; x += 7) d += `M${x} 0 V${height} `;
    for (let y = 3; y < height; y += 7) d += `M0 ${y} H${width} `;
    marks.push(<Path key="g" d={d} stroke={w} strokeWidth={1} />);
  } else if (pattern === 'hearts') {
    for (let x = 6; x < width; x += 14) {
      const y = (x / 14) % 2 ? 6 : 12;
      marks.push(<Path key={x} d={`M${x} ${y + 3} C ${x - 4} ${y} ${x - 3} ${y - 4} ${x} ${y - 1.5} C ${x + 3} ${y - 4} ${x + 4} ${y} ${x} ${y + 3} Z`} fill={w} />);
    }
  } else if (pattern === 'snow') {
    for (let x = 4; x < width; x += 9) {
      for (let y = 4; y < height; y += 8) {
        if ((x + y) % 3 === 0) marks.push(<Circle key={`${x}-${y}`} cx={x + ((y / 8) % 2) * 4} cy={y} r={1.7} fill="#FFFFFF" />);
      }
    }
  } else if (pattern === 'dots') {
    for (let x = 4; x < width; x += 8) {
      for (let y = 4; y < height; y += 8) marks.push(<Circle key={`${x}-${y}`} cx={x + ((y / 8) % 2) * 4} cy={y} r={1.6} fill={w} />);
    }
  }
  return <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>{marks}</Svg>;
}

export function Washi({ pattern, color, width = 70, height = 20, angle = -3, style }) {
  const { season } = useTheme();
  const c = color || (season ? season.tape : '#F2CD6E');
  const p = pattern || (season ? season.pattern : 'stripes');
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[{ position: 'absolute', top: -9, alignSelf: 'center', width, height, transform: [{ rotate: `${angle}deg` }], opacity: 0.9, overflow: 'hidden', backgroundColor: c }, style]}>
      <WashiPattern pattern={p} width={width} height={height} />
    </View>
  );
}

/* ---------- Push pin + paper clip ---------- */
export function Pushpin({ color = '#E0533F', size = 16, style }) {
  return (
    <View pointerEvents="none" style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, borderWidth: 1.5, borderColor: INK, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 1.5, shadowOffset: { width: 1, height: 2 }, elevation: 3 }, style]}>
      <View style={{ position: 'absolute', top: size * 0.18, left: size * 0.2, width: size * 0.28, height: size * 0.28, borderRadius: size, backgroundColor: 'rgba(255,255,255,0.7)' }} />
    </View>
  );
}

export function PaperClip({ size = 34, color = '#7D786B', style }) {
  if (!SvgLib) return null;
  const { default: Svg, Path } = SvgLib;
  return (
    <Svg width={size * 0.47} height={size} viewBox="0 0 16 34" style={style} pointerEvents="none">
      <Path d="M4 8v16a4 4 0 0 0 8 0V6a3 3 0 0 0-6 0v17a1 1 0 0 0 2 0V9" stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/* ---------- Polaroid ---------- */
export function Polaroid({
  uri, color = 'blue', icon = 'camera', caption, sub, tilt, seed, onPress, stamp, photoHeight = 120, tape = true, style, children,
}) {
  const { t } = useTheme();
  const angle = tilt != null ? tilt : seed != null ? tiltFor(seed, 2.4) : 0;
  const body = (
    <View style={[{ backgroundColor: '#FFFFFF', padding: 8, paddingBottom: 10, borderRadius: 2, transform: [{ rotate: `${angle}deg` }] }, shadow(t, 1), style]}>
      {tape ? <Washi width={56} height={18} angle={-angle * 1.5 + 3} /> : null}
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: photoHeight, backgroundColor: '#EEE' }} resizeMode="cover" />
      ) : (
        <View style={{ height: photoHeight, backgroundColor: t.postit[color] || color, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={32} color={INK} />
        </View>
      )}
      {caption ? <T kind="hand" color={INK} style={{ marginTop: 8, fontSize: 21, lineHeight: 22 }} numberOfLines={2}>{caption}</T> : null}
      {sub ? <T kind="small" color="#4B5571" style={{ fontSize: 11.5, marginTop: 2 }} numberOfLines={1}>{sub}</T> : null}
      {children}
      {stamp ? <View style={{ position: 'absolute', top: 14, right: 12 }}>{stamp}</View> : null}
    </View>
  );
  if (!onPress) return body;
  return <Pressable onPress={() => { tap(); onPress(); }} accessibilityRole="button" accessibilityLabel={caption}>{body}</Pressable>;
}

/* ---------- Seasonal decorations ---------- */
const LEAF = (x, y, r, fill) => ({ d: 'M0 -8 C 6 -6 8 0 0 8 C -8 0 -6 -6 0 -8 Z', x, y, r, fill, vein: true });
const HEART = (x, y, r, fill) => ({ d: 'M0 4 C -7 -1 -6 -7 0 -3.5 C 6 -7 7 -1 0 4 Z', x, y, r, fill });

function Shapes({ items, scale = 1 }) {
  const { G, Path } = SvgLib;
  return items.map((s, i) => (
    <G key={i} transform={`translate(${s.x} ${s.y}) rotate(${s.r}) scale(${scale})`}>
      <Path d={s.d} fill={s.fill} stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
      {s.vein ? <Path d="M0 -8 L0 8" stroke={INK} strokeWidth={0.9} /> : null}
    </G>
  ));
}

function DecorArt({ kind, dark }) {
  const { default: Svg, Path, Circle, Ellipse, G, Line } = SvgLib;
  if (kind === 'lights') {
    const colors = ['#E0533F', '#F2C14E', '#3FA66A', '#2F5BD3'];
    const bulbs = [30, 90, 150, 210, 270, 330];
    return (
      <Svg width="100%" height={34} viewBox="0 0 360 34" preserveAspectRatio="none">
        <Path d="M0 4 Q30 22 60 4 Q90 22 120 4 Q150 22 180 4 Q210 22 240 4 Q270 22 300 4 Q330 22 360 4" stroke={dark ? '#CFCBBD' : INK} strokeWidth={1.2} fill="none" />
        {bulbs.map((x, i) => <Ellipse key={x} cx={x} cy={19} rx={4} ry={6} fill={colors[i % 4]} stroke={INK} strokeWidth={0.8} />)}
      </Svg>
    );
  }
  if (kind === 'leaves') {
    const items = [LEAF(24, 16, -25, '#E8A15C'), LEAF(92, 22, 35, '#C8413B'), LEAF(160, 13, -10, '#D9A441'), LEAF(232, 21, 50, '#B5651D'), LEAF(300, 14, -40, '#E8A15C'), LEAF(345, 23, 20, '#C8413B')];
    return <Svg width="100%" height={34} viewBox="0 0 360 34"><Shapes items={items} /></Svg>;
  }
  if (kind === 'hearts') {
    const items = [HEART(26, 16, -12, '#F4A9B8'), HEART(98, 22, 10, '#E0533F'), HEART(170, 14, -4, '#F4A9B8'), HEART(240, 21, 14, '#E0533F'), HEART(312, 15, -10, '#F4A9B8')];
    return <Svg width="100%" height={34} viewBox="0 0 360 34"><Shapes items={items} scale={1.4} /></Svg>;
  }
  if (kind === 'shamrocks') {
    const at = [[30, 17], [110, 20], [190, 15], [270, 21], [340, 16]];
    return (
      <Svg width="100%" height={34} viewBox="0 0 360 34">
        {at.map(([x, y]) => (
          <G key={x} transform={`translate(${x} ${y})`}>
            <Circle cx={-4} cy={-2} r={4.2} fill="#5CB176" stroke={INK} strokeWidth={0.9} />
            <Circle cx={4} cy={-2} r={4.2} fill="#5CB176" stroke={INK} strokeWidth={0.9} />
            <Circle cx={0} cy={-8} r={4.2} fill="#5CB176" stroke={INK} strokeWidth={0.9} />
            <Path d="M0 0 Q2 7 5 10" stroke={INK} strokeWidth={1.2} fill="none" />
          </G>
        ))}
      </Svg>
    );
  }
  if (kind === 'fireworks') {
    const bursts = [[50, 17, '#F2C14E'], [180, 15, '#2F5BD3'], [300, 18, '#E0533F']];
    return (
      <Svg width="100%" height={34} viewBox="0 0 360 34">
        {bursts.map(([cx, cy, c]) => (
          <G key={cx}>
            {Array.from({ length: 10 }).map((_, i) => {
              const a = (i / 10) * Math.PI * 2;
              return <Line key={i} x1={cx + Math.cos(a) * 4} y1={cy + Math.sin(a) * 4} x2={cx + Math.cos(a) * 13} y2={cy + Math.sin(a) * 13} stroke={c} strokeWidth={1.8} strokeLinecap="round" />;
            })}
            <Circle cx={cx} cy={cy} r={2} fill={c} />
          </G>
        ))}
      </Svg>
    );
  }
  return null;
}

/** A thin decorated band for the top of a page. Shows only when the
    season setting is "on". Lights and fireworks twinkle; leaves and
    hearts sway a little; all of it holds still with Reduce Motion. */
export function SeasonDecor({ style }) {
  const { season, seasonLevel, mode } = useTheme();
  const reduce = useReduceMotion();
  const v = useRef(new Animated.Value(0)).current;
  const twinkle = season && (season.decor === 'lights' || season.decor === 'fireworks');
  const active = !!(season && seasonLevel === 'on' && SvgLib);
  useEffect(() => {
    if (!active || reduce) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: twinkle ? 1100 : 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: twinkle ? 1100 : 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, reduce, twinkle]);
  if (!active) return null;
  const anim = reduce ? null : twinkle
    ? { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }) }
    : { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, 2.5] }) }] };
  return (
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ height: 34, marginBottom: 2 }, anim, style]}>
      <DecorArt kind={season.decor} dark={mode === 'dark'} />
    </Animated.View>
  );
}

/** What the paper plane wears this season. Sits on top of the Pilot
    button; shows for "on" and "minimal". */
export function PlaneOutfit({ size = 26, style }) {
  const { season } = useTheme();
  if (!season || !SvgLib) return null;
  const { default: Svg, Path, Circle } = SvgLib;
  let art = null;
  switch (season.outfit) {
    case 'santa':
      art = (
        <>
          <Path d="M4 19 L13 3 L21 18 Z" fill="#E0533F" stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
          <Path d="M3 19.5 L22 18" stroke="#FFFFFF" strokeWidth={4} strokeLinecap="round" />
          <Circle cx={13} cy={3} r={2.6} fill="#FFFFFF" stroke={INK} strokeWidth={1} />
        </>
      );
      break;
    case 'party':
      art = (
        <>
          <Path d="M6 21 L12 3 L18 21 Z" fill="#F2C14E" stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
          <Path d="M8.5 14 L15.5 12 M7.5 18 L16.8 16" stroke="#2F5BD3" strokeWidth={1.6} />
          <Circle cx={12} cy={3} r={2.2} fill="#E0533F" stroke={INK} strokeWidth={1} />
        </>
      );
      break;
    case 'heart':
      art = <Path d="M12 21 C 2 14 3 5 12 9 C 21 5 22 14 12 21 Z" fill="#E0533F" stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />;
      break;
    case 'shamrock':
      art = (
        <>
          <Circle cx={8} cy={11} r={4.6} fill="#5CB176" stroke={INK} strokeWidth={1.1} />
          <Circle cx={16} cy={11} r={4.6} fill="#5CB176" stroke={INK} strokeWidth={1.1} />
          <Circle cx={12} cy={5} r={4.6} fill="#5CB176" stroke={INK} strokeWidth={1.1} />
          <Path d="M12 14 Q13 19 16 22" stroke={INK} strokeWidth={1.5} fill="none" />
        </>
      );
      break;
    case 'leaf':
      art = (
        <>
          <Path d="M12 2 C 20 5 22 13 12 22 C 2 13 4 5 12 2 Z" fill="#E8A15C" stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />
          <Path d="M12 2 L12 22" stroke={INK} strokeWidth={1} />
        </>
      );
      break;
    default:
      return null;
  }
  return (
    <View pointerEvents="none" style={[{ position: 'absolute' }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">{art}</Svg>
    </View>
  );
}
