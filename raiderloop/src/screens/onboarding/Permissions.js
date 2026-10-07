/**
 * Permissions are asked here with a plain-English reason first, and
 * every one is optional — declining never blocks onboarding.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { useApp } from '../../state/AppContext';
import { useTheme } from '../../theme/ThemeContext';
import { T, Button, Card, Stamp } from '../../ui/Paper';
import Icon from '../../ui/Icon';
import { Shell, Heading } from './Shell';
import { ensureNotificationPermission } from '../../lib/notifications';
import { getForegroundPermission } from '../../lib/location';
import { initAds } from '../../lib/monetize';
import { Notifications, Location, Tracking } from '../../lib/native';

function Perm({ icon, title, body, state, onAsk, color }) {
  const { t } = useTheme();
  return (
    <Card style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: t.postit[color], alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Icon name={icon} color="#1F2A44" />
        </View>
        <View style={{ flex: 1 }}>
          <T kind="bold">{title}</T>
          <T kind="small" style={{ marginTop: 2 }}>{body}</T>
          <View style={{ marginTop: 10, flexDirection: 'row' }}>
            {state === 'granted' ? <Stamp label="On" color={t.ok} />
              : state === 'denied' ? <Stamp label="Off — change in Settings" color={t.pencil} />
                : <Button title="Allow" small onPress={onAsk} />}
          </View>
        </View>
      </View>
    </Card>
  );
}

export default function Permissions() {
  const { set } = useApp();
  const [notif, setNotif] = useState(Notifications ? 'ask' : 'denied');
  const [loc, setLoc] = useState(Location ? 'ask' : 'denied');
  const [ads, setAds] = useState(Tracking ? 'ask' : null);
  return (
    <Shell step="permissions" onBack={() => set({ onboardStep: 'schedule' })}
      footer={<Button title="Continue" icon="chevronRight" onPress={() => set({ onboardStep: 'tour', adConsentAsked: true })} />}>
      <Heading eyebrow="step seven" title="A few quick yeses" sub="All optional. You can change any of these later in Settings." />
      <Perm icon="bell" color="yellow" title="Reminders" state={notif}
        body="A nudge before each class (with rain or cold heads-ups), before assignments are due, and before saved events."
        onAsk={async () => setNotif((await ensureNotificationPermission(true)) ? 'granted' : 'denied')} />
      <Perm icon="location" color="green" title="Location while using Flyer" state={loc}
        body="Sorts what's open by real walking distance. Friends can only ever see you if you turn on sharing and pick them — that's separate."
        onAsk={async () => setLoc((await getForegroundPermission(true)) ? 'granted' : 'denied')} />
      {ads ? (
        <Perm icon="tag" color="pink" title="Ads that keep Flyer free" state={ads}
          body="iOS will ask if apps can track you across other apps. Saying no is totally fine — you'll still see ads, just less relevant ones. Your schedule, location, and friends are never shared with advertisers."
          onAsk={async () => { await initAds({ askTracking: true }); setAds('granted'); }} />
      ) : null}
    </Shell>
  );
}
