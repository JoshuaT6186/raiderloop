import React from 'react';
import { View, ScrollView, Pressable, SafeAreaView, Platform } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { PAD } from '../../theme/tokens';
import { T, NotebookBg } from '../../ui/Paper';
import Icon from '../../ui/Icon';

export const STEPS = ['account', 'school', 'profile', 'avatar', 'interests', 'schedule', 'permissions', 'tour'];

export function Shell({ step, children, footer, onBack, scroll = true }) {
  const { t } = useTheme();
  const idx = STEPS.indexOf(step);
  const Body = scroll ? ScrollView : View;
  return (
    <View style={{ flex: 1, backgroundColor: t.paper }}>
      <NotebookBg />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD, paddingTop: Platform.OS === 'android' ? 34 : 8, height: 56 }}>
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
              <Icon name="chevronLeft" color={t.ink} />
            </Pressable>
          ) : <View style={{ width: 22 }} />}
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center' }}>
            {idx >= 0 ? STEPS.map((s, i) => (
              <View key={s} style={{
                width: i === idx ? 22 : 8, height: 8, borderRadius: 4, marginHorizontal: 3,
                backgroundColor: i <= idx ? t.accent : t.border,
              }} />
            )) : null}
          </View>
          <View style={{ width: 22 }} />
        </View>
        <Body style={{ flex: 1 }} contentContainerStyle={scroll ? { paddingLeft: PAD + 22, paddingRight: PAD, paddingBottom: 30 } : null} keyboardShouldPersistTaps="handled">
          {scroll ? children : <View style={{ flex: 1, paddingLeft: PAD + 22, paddingRight: PAD }}>{children}</View>}
        </Body>
        {footer ? <View style={{ paddingLeft: PAD + 22, paddingRight: PAD, paddingBottom: 12, paddingTop: 8 }}>{footer}</View> : null}
      </SafeAreaView>
    </View>
  );
}

export function Heading({ eyebrow, title, sub }) {
  const { t } = useTheme();
  return (
    <View style={{ marginTop: 18, marginBottom: 20 }}>
      {eyebrow ? <T kind="hand" color={t.accent}>{eyebrow}</T> : null}
      <T kind="marker" style={{ fontSize: 32, lineHeight: 38 }}>{title}</T>
      {sub ? <T kind="body" color={t.inkSoft} style={{ marginTop: 6 }}>{sub}</T> : null}
    </View>
  );
}
