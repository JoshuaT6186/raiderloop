/**
 * Push notifications for things that happen while Flyer is closed:
 * a Say hi, a Flyer Drop, a group update, your turn in office hours,
 * and Safe Walk alerts. Sent through Expo's push service; the token
 * is saved to your account only after you've allowed notifications.
 */
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Notifications, Constants } from './native';
import { api } from './firebase';

async function expoToken() {
  if (!Notifications || Platform.OS === 'web') return null;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return null;
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
  if (!projectId || /REPLACE/i.test(projectId)) return null;
  const t = await Notifications.getExpoPushTokenAsync({ projectId });
  return t?.data || null;
}

/** Keeps this phone's push token on your account, and routes taps. */
export function usePush({ user, onboarded, prefs, onRoute }) {
  const sent = useRef('');
  const routeRef = useRef(onRoute);
  routeRef.current = onRoute;
  const prefsKey = JSON.stringify(prefs || {});
  useEffect(() => {
    if (!user || user.isAnonymous || !onboarded) return;
    let live = true;
    expoToken().then((token) => {
      const key = `${user.uid}|${token}|${prefsKey}`;
      if (!live || !token || sent.current === key) return;
      sent.current = key;
      api.savePushToken({ token, prefs: prefs || {} }).catch(() => { sent.current = ''; });
    }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, onboarded, prefsKey]);

  useEffect(() => {
    if (!Notifications) return undefined;
    const handle = (resp) => {
      const data = resp?.notification?.request?.content?.data;
      if (data && data.route && routeRef.current) routeRef.current(data);
    };
    Notifications.getLastNotificationResponseAsync?.().then((r) => r && handle(r)).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub && sub.remove();
  }, []);
}

/** Called on sign-out so this phone stops getting your pushes. */
export async function forgetPushToken() {
  try { const token = await expoToken(); if (token) await api.savePushToken({ token, remove: true }); } catch (e) { /* offline is fine */ }
}
