/**
 * Report and block, from anywhere (App Store Guideline 1.2).
 * Reporting hides the thing from you right away; a person reviews the
 * report. Blocking is silent: the other person is never told.
 */
import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { Sheet, T, PostIt, PT, Button, Chip, Field } from '../ui/Paper';
import { useApp } from '../state/AppContext';
import { useTheme } from '../theme/ThemeContext';
import { api } from '../lib/firebase';

const REASONS = ['Spam or a scam', 'Harassment or bullying', 'Hate speech', 'Nudity or sexual', 'Violence or threats', 'Shares private info', 'Pretending to be someone', 'Something else'];

export function ReportSheet({ kind, id, uid, name, onClose, onDone }) {
  const { t } = useTheme();
  const { hide, showToast } = useApp();
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await api.report({ kind, id, uid, reason, note });
      if (id) hide(kind, id);
      if (kind === 'user' && uid) hide('user', uid);
      showToast('Thanks. We hid it for you and will review it.');
      onDone && onDone(); onClose();
    } catch (e) { showToast(e.message || "Couldn't send the report. Try again."); }
    setBusy(false);
  };
  const block = () => Alert.alert(`Block ${name || 'this person'}?`, "They won't be able to find you, add you, or see your stuff. They aren't told.", [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Block', style: 'destructive',
      onPress: async () => {
        try { await api.blockUser({ uid }); hide('user', uid); showToast('Blocked'); onDone && onDone(); onClose(); } catch (e) { showToast(e.message || "Couldn't block. Try again."); }
      },
    },
  ]);
  return (
    <Sheet title="Report" hand="Tell us what's wrong. It stays private." onClose={onClose} height={0.8}
      footer={(
        <View>
          <Button title="Send report" icon="flag" kind="danger" disabled={!reason} loading={busy} onPress={send} />
          {uid ? <Button title={`Block ${name || 'this person'}`} kind="ghost" small onPress={block} style={{ marginTop: 10 }} /> : null}
        </View>
      )}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {REASONS.map((r) => <Chip key={r} label={r} active={reason === r} color="pink" onPress={() => setReason(r)} />)}
      </View>
      <Field label="Anything else? (optional)" value={note} onChangeText={setNote} multiline placeholder="What happened" inputStyle={{ minHeight: 80 }} />
      <PostIt color="blue" tilt={-0.5}>
        <PT kind="small">If someone is in danger right now, call 911. For something on campus, Texas Tech Police is 806-742-3931.</PT>
      </PostIt>
      <T kind="small" style={{ marginTop: 10 }} color={t.pencil}>Reports go to the person who runs Flyer, not to whoever you're reporting.</T>
    </Sheet>
  );
}

/* A small "•••" menu: report, plus block when there's a person. */
export function useReportMenu() {
  const [target, setTarget] = useState(null);
  const open = (x) => setTarget(x);
  const node = target ? <ReportSheet {...target} onClose={() => setTarget(null)} /> : null;
  return { open, node };
}
