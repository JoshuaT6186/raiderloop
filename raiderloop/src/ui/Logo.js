/**
 * Flyer mark — a folded paper airplane with a dashed flight loop.
 * Same geometry is used for the app icon assets, so the
 * app icon and in-app logo always match.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { SvgLib } from '../lib/native';
import { useTheme } from '../theme/ThemeContext';

export const PLANE = {
  wing: 'M90 14 L8 46 L40 57 Z',
  body: 'M90 14 L40 57 L50 86 Z',
  fold: 'M40 57 L50 86 L56 66 Z',
  crease: 'M90 14 L40 57',
  trail: 'M4 95 C 14 95 20 90 20 82 C 20 74 10 74 12 80 C 14 86 26 84 34 74',
};

export function PlaneMark({ size = 48, color, paper = '#FFFFFF', shade, trail = true, trailColor }) {
  const { t } = useTheme();
  const ink = color || t.ink;
  if (!SvgLib) return <Text style={{ fontSize: size * 0.7 }}>✈︎</Text>;
  const { default: Svg, Path } = SvgLib;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {trail ? (
        <Path d={PLANE.trail} stroke={trailColor || t.accent} strokeWidth={4} strokeDasharray="6 7" strokeLinecap="round" fill="none" />
      ) : null}
      <Path d={PLANE.body} fill={shade || '#D9E4F5'} stroke={ink} strokeWidth={4.5} strokeLinejoin="round" />
      <Path d={PLANE.fold} fill={shade || '#C3D3EE'} stroke={ink} strokeWidth={4.5} strokeLinejoin="round" />
      <Path d={PLANE.wing} fill={paper} stroke={ink} strokeWidth={4.5} strokeLinejoin="round" />
      <Path d={PLANE.crease} stroke={ink} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

export function Wordmark({ size = 34, color }) {
  const { t, f } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <PlaneMark size={size * 1.15} />
      <Text style={{ fontFamily: f.marker, fontSize: size, color: color || t.ink, marginLeft: 6, letterSpacing: 0.5, fontWeight: f.marker ? undefined : '900' }}>
        Flyer
      </Text>
    </View>
  );
}
