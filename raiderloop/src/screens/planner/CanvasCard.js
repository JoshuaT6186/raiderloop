/**
 * Canvas connection card. Three honest states:
 *  1. Not configured (no Developer Key yet) → explains why, offers
 *     manual entry. No dead button.
 *  2. Configured, not connected → "Sign in with Canvas".
 *  3. Connected → last sync, Sync now, Disconnect.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../../state/AppContext';
import { useTheme } from '../../theme/ThemeContext';
import { T, Card, Button, Stamp } from '../../ui/Paper';
import Icon from '../../ui/Icon';
import { isCanvasConfigured, connectCanvas, syncCanvas, disconnectCanvas } from '../../lib/canvas';

export default function CanvasCard() {
  const { t } = useTheme();
  const { user, profile, mergeCanvasAssignments, schoolId, showToast, set } = useApp();
  const [busy, setBusy] = useState(false);
  const connected = !!profile?.canvasConnected;

  const apply = (data) => {
    mergeCanvasAssignments(data.assignments || []);
    if (data.courses?.length) set({ canvasCourses: data.courses });
    showToast(`Synced ${data.assignments?.length || 0} assignments from Canvas`);
  };

  if (!isCanvasConfigured()) {
    return (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="link" color={t.inkSoft} />
          <T kind="bold" style={{ marginLeft: 8, flex: 1 }}>Canvas sync</T>
          <Stamp label="Waiting on approval" color={t.warn} />
        </View>
        <T kind="small" style={{ marginTop: 6 }}>
          Automatic assignment sync needs the university to register Flyer with Canvas. Until then, add assignments here and you'll still get every reminder.
        </T>
      </Card>
    );
  }

  if (!user || user.isAnonymous) {
    return (
      <Card>
        <T kind="bold">Sync assignments from Canvas</T>
        <T kind="small" style={{ marginTop: 4 }}>Make a free account first (You → Account), then connect Canvas.</T>
      </Card>
    );
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Icon name="link" color={t.inkSoft} />
        <T kind="bold" style={{ marginLeft: 8, flex: 1 }}>Canvas</T>
        {connected ? <Stamp label="Connected" color={t.ok} /> : null}
      </View>
      <T kind="small" style={{ marginTop: 6 }}>
        {connected
          ? 'Upcoming assignments and current scores sync from your courses.'
          : "You'll sign in on Canvas's own page — Flyer never sees your password."}
      </T>
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        {connected ? (
          <>
            <Button title="Sync now" icon="refresh" small loading={busy} onPress={async () => { setBusy(true); try { apply(await syncCanvas()); } catch (e) { showToast(e.message); } setBusy(false); }} style={{ marginRight: 8 }} />
            <Button title="Disconnect" small kind="ghost" onPress={async () => { await disconnectCanvas().catch(() => {}); mergeCanvasAssignments([]); showToast('Canvas disconnected'); }} />
          </>
        ) : (
          <Button title="Sign in with Canvas" icon="lock" small loading={busy} onPress={async () => { setBusy(true); try { apply(await connectCanvas(schoolId)); } catch (e) { showToast(e.message); } setBusy(false); }} />
        )}
      </View>
    </Card>
  );
}
