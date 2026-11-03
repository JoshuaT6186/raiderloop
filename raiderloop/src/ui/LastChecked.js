/**
 * "Checked Oct 28, 2026 · Looks wrong?" A small, honest freshness line
 * for official info. Tapping "Looks wrong?" asks what's off and sends
 * it to the Admin screen (Firestore: outdated).
 */
import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { T, Field, Button } from './Paper';
import Icon from './Icon';
import { useTheme } from '../theme/ThemeContext';
import { useApp } from '../state/AppContext';
import { api } from '../lib/firebase';

export const checkedLabel = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null);

export default function LastChecked({ date, source, itemId, title, url, style }) {
  const { t } = useTheme();
  const { showToast } = useApp();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const send = async () => {
    try { await api.reportOutdated({ itemId, title, url, note }); setSent(true); setOpen(false); showToast("Thanks. We'll re-check it."); } catch (e) { showToast(e.message); }
  };
  const when = checkedLabel(date);
  return (
    <View style={[{ marginTop: 8 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
        <Icon name="check" size={13} color={t.ok} style={{ marginRight: 4 }} />
        <T kind="small" style={{ fontSize: 11.5 }} color={t.pencil}>{[when ? `Checked ${when}` : 'From the official page', source].filter(Boolean).join(' · ')}</T>
        {sent ? <T kind="small" style={{ fontSize: 11.5, marginLeft: 6 }} color={t.ok}>Thanks!</T> : (
          <Pressable onPress={() => setOpen(!open)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Report that this looks out of date">
            <T kind="small" style={{ fontSize: 11.5, marginLeft: 6, textDecorationLine: 'underline' }} color={t.pencil}>Looks wrong?</T>
          </Pressable>
        )}
      </View>
      {open ? (
        <View style={{ marginTop: 6 }}>
          <Field placeholder="What changed? (optional)" value={note} onChangeText={setNote} maxLength={300} />
          <Button title="Send" small icon="send" onPress={send} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : null}
    </View>
  );
}
