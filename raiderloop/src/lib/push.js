/**
 * Push notifications (messages, meetups, friend requests, nearby).
 * ------------------------------------------------------------
 * The phone gets an Expo push token, which is saved to your account
 * so the server can reach you. Apple delivery needs a push key in
 * your EAS credentials (see SETUP.md). Tapping a notification opens
 * the right chat, meetup, or friend.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Notifications, Constants, AsyncStorage } from './native';
import { api } from './firebase';
import { ensureNotificationPermission } from './notifications';

const TOKEN_KEY = 'flyer_push_token';

export async function registerPush({ ask = false } = {}) {
  if (!Notifications || Platform.OS === 'web') return null;
  if (!(await ensureNotificationPermission(ask))) return null;
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId;
  if (!projectId) return null;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
  if (!data) return null;
  await api.savePushToken({ token: data });
  if (AsyncStorage) await AsyncStorage.setItem(TOKEN_KEY, data).catch(() => {});
  return data;
}

/* On sign-out, this phone stops getting that account's pushes. */
export async function unregisterPush() {
  if (!AsyncStorage) return;
  const token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (token) await api.removePushToken({ token }).catch(() => {});
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
}

export function usePushRegistration({ user, onboarded }) {
  useEffect(() => {
    if (!user || user.isAnonymous || !onboarded) return;
    registerPush({ ask: false }).catch(() => {});
  }, [user?.uid, onboarded]);
}

export function useNotificationTaps(onOpen) {
  useEffect(() => {
    if (!Notifications) return undefined;
    const handle = (r) => { const d = r?.notification?.request?.content?.data; if (d && d.open) onOpen(d); };
    Notifications.getLastNotificationResponseAsync?.().then(handle).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
