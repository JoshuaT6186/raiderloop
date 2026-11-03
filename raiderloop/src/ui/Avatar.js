/**
 * Doodle avatar renderer (100×100 viewBox).
 * Layer order: background → hair (back) → body/shirt → neck → ears
 * → head → facial hair → face → hair (front) → glasses → hat.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { SvgLib } from '../lib/native';
import { useTheme } from '../theme/ThemeContext';
import { DEFAULT_AVATAR } from './avatarParts';

const INK = '#1F2A44';
const SW = 2.2;
const circle = (cx, cy, r) => `M${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`;

const HAIR_BACK = {
  afro: circle(50, 38, 29),
  long: 'M27 44 C 23 66 25 84 33 88 L 67 88 C 75 84 77 66 73 44 Z',
  bob: 'M26 44 C 24 60 27 70 34 71 L 66 71 C 73 70 76 60 74 44 Z',
  ponytail: 'M67 38 C 86 44 86 70 75 80 C 78 64 75 52 64 45 Z',
  braids: 'M28 48 L 29 88 L 37 88 L 36 48 Z M64 48 L 63 88 L 71 88 L 72 48 Z',
  locs: 'M27 44 L 26 82 L 32 82 L 33 54 Z M34 52 L 34 86 L 39 86 L 39 56 Z M61 56 L 61 86 L 66 86 L 66 52 Z M67 54 L 68 82 L 74 82 L 73 44 Z',
};
const HAIR_FRONT = {
  buzz: 'M30 44 C 29 25 71 25 70 44 C 66 34 34 34 30 44 Z',
  short: 'M28 46 C 25 21 75 19 72 46 C 68 36 58 32 50 33 C 42 32 32 36 28 46 Z',
  side: 'M28 48 C 23 19 77 17 72 46 C 70 38 64 33 57 33 C 49 37 39 30 33 38 C 30 41 29 44 28 48 Z',
  curly: 'M27 46 a6 6 0 0 1 4-10 a6 6 0 0 1 8-8 a6 6 0 0 1 11-3 a6 6 0 0 1 11 3 a6 6 0 0 1 8 8 a6 6 0 0 1 4 10 C 66 37 34 37 27 46 Z',
  afro: 'M29 44 C 32 32 68 32 71 44 C 70 30 60 26 50 26 C 40 26 30 30 29 44 Z',
  long: 'M27 50 C 23 18 77 18 73 50 C 70 36 62 30 50 30 C 40 34 33 38 27 50 Z',
  bob: 'M26 48 C 23 18 77 18 74 48 C 72 38 64 33 56 34 C 48 40 34 38 26 48 Z',
  bun: 'M28 46 C 25 21 75 19 72 46 C 68 36 58 32 50 33 C 42 32 32 36 28 46 Z',
  ponytail: 'M28 46 C 25 21 75 19 72 46 C 68 37 58 33 50 33 C 42 33 32 37 28 46 Z',
  braids: 'M28 48 C 26 22 74 22 72 48 C 68 36 56 32 50 30 C 44 32 32 36 28 48 Z',
  locs: 'M27 46 C 25 21 75 19 73 46 C 68 37 58 32 50 33 C 42 32 32 37 27 46 Z',
};

const SHIRT_BODY = 'M16 100 C 18 83 33 76 50 76 C 67 76 82 83 84 100 Z';

export default function Avatar({ config, size = 56, ring = true, bg = true, style }) {
  const { t } = useTheme();
  const a = { ...DEFAULT_AVATAR, ...(config || {}) };
  const bgColor = t.postit[a.bg] || t.postit.yellow;
  if (!SvgLib) {
    return <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor }, style]} />;
  }
  const { default: Svg, Path, Circle, Ellipse, Rect, G, Text: SvgText, ClipPath, Defs } = SvgLib;
  const hair = a.hairColor;
  const hasHat = a.hat && a.hat !== 'none';
  const clipId = `clip-${size}`;

  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', borderWidth: ring ? Math.max(1.5, size / 30) : 0, borderColor: INK, backgroundColor: bg ? bgColor : 'transparent' }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <ClipPath id={clipId}><Circle cx="50" cy="50" r="50" /></ClipPath>
        </Defs>
        <G clipPath={`url(#${clipId})`}>
          {bg ? <Path d="M10 20 l4 0 M80 14 l3 3 M86 60 l4 -2 M8 70 l3 3" stroke={INK} strokeOpacity={0.18} strokeWidth={2} strokeLinecap="round" /> : null}

          {/* hair behind */}
          {HAIR_BACK[a.hair] ? <Path d={HAIR_BACK[a.hair]} fill={hair} stroke={INK} strokeWidth={SW} strokeLinejoin="round" /> : null}

          {/* body */}
          <Path d={SHIRT_BODY} fill={a.shirtColor} stroke={INK} strokeWidth={SW} />
          {a.shirt === 'hoodie' ? (
            <>
              <Path d="M33 80 C 38 70 62 70 67 80 C 60 86 40 86 33 80 Z" fill={a.shirtColor} stroke={INK} strokeWidth={SW} />
              <Path d="M45 83 L 44 93 M55 83 L 56 93" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
            </>
          ) : null}
          {a.shirt === 'collar' ? <Path d="M40 77 L 50 88 L 60 77 L 56 75 L 50 82 L 44 75 Z" fill="#FFFFFF" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" /> : null}
          {a.shirt === 'jersey' ? (
            <>
              <Path d="M22 92 L 30 84 M78 92 L 70 84" stroke="#FFFFFF" strokeWidth={3} />
              <SvgText x="50" y="97" fontSize="13" fontWeight="900" fill="#FFFFFF" stroke={INK} strokeWidth={0.6} textAnchor="middle">{String(a.number || '26').slice(0, 2)}</SvgText>
            </>
          ) : null}
          {a.shirt === 'tee' ? <Path d="M43 77 Q 50 83 57 77" stroke={INK} strokeWidth={1.8} fill="none" /> : null}

          {/* neck + ears + head */}
          <Rect x="44" y="64" width="12" height="13" fill={a.skin} stroke={INK} strokeWidth={SW} />
          <Circle cx="29" cy="50" r="5" fill={a.skin} stroke={INK} strokeWidth={SW} />
          <Circle cx="71" cy="50" r="5" fill={a.skin} stroke={INK} strokeWidth={SW} />
          <Ellipse cx="50" cy="47" rx="21" ry="24" fill={a.skin} stroke={INK} strokeWidth={SW} />
          {a.accessory === 'earrings' ? (
            <>
              <Circle cx="28.5" cy="56.5" r="2" fill="#F2C94C" stroke={INK} strokeWidth={1.2} />
              <Circle cx="71.5" cy="56.5" r="2" fill="#F2C94C" stroke={INK} strokeWidth={1.2} />
            </>
          ) : null}

          {/* facial hair */}
          {a.facialHair === 'beard' ? <Path d="M29.5 50 C 30 68 40 72 50 72 C 60 72 70 68 70.5 50 C 67 62 60 64 50 64 C 40 64 33 62 29.5 50 Z" fill={hair} stroke={INK} strokeWidth={1.8} /> : null}
          {a.facialHair === 'goatee' ? <Path d="M45 63 C 46 70 54 70 55 63 C 53 65 47 65 45 63 Z" fill={hair} stroke={INK} strokeWidth={1.6} /> : null}
          {a.facialHair === 'stubble' ? <Path d="M33 58 C 36 68 44 70 50 70 C 56 70 64 68 67 58" stroke={hair} strokeOpacity={0.5} strokeWidth={4} strokeDasharray="1 2.6" strokeLinecap="round" fill="none" /> : null}

          {/* blush */}
          {a.blush ? (
            <>
              <Ellipse cx="37" cy="56" rx="4" ry="2.4" fill="#F28B82" opacity={0.45} />
              <Ellipse cx="63" cy="56" rx="4" ry="2.4" fill="#F28B82" opacity={0.45} />
            </>
          ) : null}

          {/* eyes */}
          <Eyes kind={a.eyes} />
          {/* brows */}
          <Path d="M38 41.5 Q 42 39.5 46 41.5 M54 41.5 Q 58 39.5 62 41.5" stroke={a.hair === 'none' ? INK : hair} strokeWidth={2.2} strokeLinecap="round" fill="none" />

          {/* mustache sits above mouth */}
          {a.facialHair === 'mustache' || a.facialHair === 'beard' ? (
            <Path d="M42.5 57.5 Q 46.5 54 50 56.5 Q 53.5 54 57.5 57.5 Q 53.5 59.5 50 58.2 Q 46.5 59.5 42.5 57.5 Z" fill={hair} stroke={INK} strokeWidth={1.4} />
          ) : null}
          <Mouth kind={a.mouth} />

          {/* hair front */}
          {!hasHat || a.hat === 'headphones' ? (HAIR_FRONT[a.hair] ? <Path d={HAIR_FRONT[a.hair]} fill={hair} stroke={INK} strokeWidth={SW} strokeLinejoin="round" /> : null) : null}
          {a.hair === 'bun' && !hasHat ? <Circle cx="50" cy="19" r="8" fill={hair} stroke={INK} strokeWidth={SW} /> : null}

          {/* glasses */}
          {a.accessory === 'round' ? (
            <Path d={`${circle(42, 48, 6)} ${circle(58, 48, 6)} M48 48 L 52 48 M36 47 L 30 45 M64 47 L 70 45`} stroke={INK} strokeWidth={2} fill="rgba(255,255,255,0.18)" />
          ) : null}
          {a.accessory === 'square' ? (
            <Path d="M35.5 43.5 h13 v9 h-13 Z M51.5 43.5 h13 v9 h-13 Z M48.5 47 L 51.5 47 M35.5 46 L 30 45 M64.5 46 L 70 45" stroke={INK} strokeWidth={2} fill="rgba(255,255,255,0.18)" />
          ) : null}
          {a.accessory === 'shades' ? (
            <Path d="M35 44 h13 v5 c0 4 -13 4 -13 0 Z M52 44 h13 v5 c0 4 -13 4 -13 0 Z M48 46 L 52 46 M35 45.5 L 30 45 M65 45.5 L 70 45" stroke={INK} strokeWidth={2} fill="#1F2A44" />
          ) : null}

          {/* hats */}
          <Hat kind={a.hat} hair={hair} shirt={a.shirtColor} />
          {a.accessory === 'headphones' ? (
            <>
              <Path d="M27 50 C 25 16 75 16 73 50" stroke={INK} strokeWidth={4.5} fill="none" strokeLinecap="round" />
              <Rect x="22" y="44" width="9" height="14" rx="4" fill={a.shirtColor} stroke={INK} strokeWidth={SW} />
              <Rect x="69" y="44" width="9" height="14" rx="4" fill={a.shirtColor} stroke={INK} strokeWidth={SW} />
            </>
          ) : null}
        </G>
      </Svg>
    </View>
  );
}

function Eyes({ kind }) {
  const { Path, Circle } = SvgLib;
  switch (kind) {
    case 'happy': return <Path d="M38.5 49.5 Q 42 45 45.5 49.5 M54.5 49.5 Q 58 45 61.5 49.5" stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" />;
    case 'wink': return (<><Circle cx="42" cy="48" r="2.6" fill={INK} /><Path d="M54.5 49 Q 58 46 61.5 49" stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" /></>);
    case 'sleepy': return <Path d="M38.5 48 Q 42 51.5 45.5 48 M54.5 48 Q 58 51.5 61.5 48" stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" />;
    case 'wide': return (<><Circle cx="42" cy="48" r="4.2" fill="#fff" stroke={INK} strokeWidth={1.8} /><Circle cx="58" cy="48" r="4.2" fill="#fff" stroke={INK} strokeWidth={1.8} /><Circle cx="42.6" cy="48.6" r="2" fill={INK} /><Circle cx="58.6" cy="48.6" r="2" fill={INK} /></>);
    case 'stars': return <Path d="M42 44 l1.2 2.8 3 .4 -2.2 2 .6 3 -2.6 -1.5 -2.6 1.5 .6 -3 -2.2 -2 3 -.4 Z M58 44 l1.2 2.8 3 .4 -2.2 2 .6 3 -2.6 -1.5 -2.6 1.5 .6 -3 -2.2 -2 3 -.4 Z" fill="#F2C94C" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />;
    default: return (<><Circle cx="42" cy="48" r="2.7" fill={INK} /><Circle cx="58" cy="48" r="2.7" fill={INK} /><Circle cx="42.9" cy="47.1" r="0.8" fill="#fff" /><Circle cx="58.9" cy="47.1" r="0.8" fill="#fff" /></>);
  }
}

function Mouth({ kind }) {
  const { Path, Ellipse } = SvgLib;
  switch (kind) {
    case 'grin': return <Path d="M42 58 Q 50 68 58 58 Z" fill="#fff" stroke={INK} strokeWidth={2} strokeLinejoin="round" />;
    case 'open': return <Ellipse cx="50" cy="61" rx="3.6" ry="4" fill="#5B2B2B" stroke={INK} strokeWidth={1.8} />;
    case 'smirk': return <Path d="M44 60 Q 52 63 57 57" stroke={INK} strokeWidth={2.2} strokeLinecap="round" fill="none" />;
    case 'flat': return <Path d="M45 61 L 55 60.5" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />;
    case 'tongue': return (<><Path d="M42 58 Q 50 68 58 58 Z" fill="#fff" stroke={INK} strokeWidth={2} strokeLinejoin="round" /><Path d="M47 62.5 Q 50 68 53 62.5 Z" fill="#F28B9B" stroke={INK} strokeWidth={1.4} /></>);
    default: return <Path d="M43 59 Q 50 65 57 59" stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none" />;
  }
}

function Hat({ kind, shirt }) {
  const { Path, Circle, Rect } = SvgLib;
  switch (kind) {
    case 'cap': return (<><Path d="M27 40 C 26 18 74 18 73 40 Z" fill={shirt} stroke={INK} strokeWidth={SW} /><Path d="M27 40 L 73 40 C 83 40 90 43 88 45.5 L 28 45.5 Z" fill={shirt} stroke={INK} strokeWidth={SW} strokeLinejoin="round" /><Circle cx="50" cy="20.5" r="2" fill={INK} /></>);
    case 'beanie': return (<><Path d="M26 42 C 25 14 75 14 74 42 Z" fill={shirt} stroke={INK} strokeWidth={SW} /><Rect x="25" y="35" width="50" height="9" rx="3" fill={shirt} stroke={INK} strokeWidth={SW} /><Path d="M31 36 v7 M37 36 v7 M43 36 v7 M49 36 v7 M55 36 v7 M61 36 v7 M67 36 v7" stroke={INK} strokeOpacity={0.35} strokeWidth={1.2} /><Circle cx="50" cy="14" r="5" fill="#fff" stroke={INK} strokeWidth={SW} /></>);
    case 'cowboy': return (<><Path d="M34 33 C 33 12 67 12 66 33 Z" fill="#B07A43" stroke={INK} strokeWidth={SW} /><Path d="M48 14 L 50 20 L 52 14" stroke={INK} strokeWidth={1.6} fill="none" /><Path d="M10 34 C 22 44 78 44 90 34 C 84 30 74 34 50 34 C 26 34 16 30 10 34 Z" fill="#B07A43" stroke={INK} strokeWidth={SW} strokeLinejoin="round" /><Path d="M34 30 h32" stroke={INK} strokeWidth={3} /></>);
    case 'bucket': return (<><Path d="M31 36 C 30 18 70 18 69 36 Z" fill={shirt} stroke={INK} strokeWidth={SW} /><Path d="M20 42 L 31 34 L 69 34 L 80 42 Z" fill={shirt} stroke={INK} strokeWidth={SW} strokeLinejoin="round" /></>);
    case 'grad': return (<><Path d="M34 28 L 34 37 C 40 41 60 41 66 37 L 66 28" fill="#1F2A44" stroke={INK} strokeWidth={SW} /><Path d="M50 12 L 84 23 L 50 34 L 16 23 Z" fill="#1F2A44" stroke={INK} strokeWidth={SW} strokeLinejoin="round" /><Path d="M50 23 L 78 27 L 78 38" stroke="#F2C94C" strokeWidth={2} fill="none" /><Circle cx="78" cy="39" r="2.4" fill="#F2C94C" /></>);
    default: return null;
  }
}

/* Small "friend on the map" pin — avatar in a paper-tag bubble. */
export function AvatarPin({ config, name, stale }) {
  const { t, f } = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ padding: 2, backgroundColor: '#fff', borderRadius: 26, borderWidth: 2, borderColor: INK, opacity: stale ? 0.6 : 1 }}>
        <Avatar config={config} size={40} ring={false} />
      </View>
      <View style={{ width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: INK, marginTop: -1 }} />
      {name ? (
        <View style={{ marginTop: 2, backgroundColor: t.postit.yellow, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 3, borderWidth: 1, borderColor: INK }}>
          <Text style={{ fontFamily: f.bodyBold, fontWeight: f.bodyBold ? undefined : '700', fontSize: 10.5, color: INK }} numberOfLines={1}>{name}</Text>
        </View>
      ) : null}
    </View>
  );
}
