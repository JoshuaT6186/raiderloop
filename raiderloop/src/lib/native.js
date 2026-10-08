/**
 * Optional native modules.
 * ------------------------------------------------------------
 * Every native dependency is loaded defensively, so the app still
 * boots in Expo Go (or a build missing one module) and the affected
 * feature shows an honest "not available in this build" state
 * instead of crashing on launch. Production builds via EAS include
 * all of them.
 */
import { Platform } from 'react-native';

function tryRequire(fn) {
  try { return fn(); } catch (e) { return null; }
}

export const SvgLib = tryRequire(() => require('react-native-svg'));
export const Maps = Platform.OS === 'web' ? null : tryRequire(() => require('react-native-maps'));
export const ImagePicker = tryRequire(() => require('expo-image-picker'));
export const DocumentPicker = tryRequire(() => require('expo-document-picker'));
export const FileSystem = tryRequire(() => require('expo-file-system'));
export const Notifications = tryRequire(() => {
  const N = require('expo-notifications');
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true,
      shouldPlaySound: false, shouldSetBadge: false,
    }),
  });
  return N;
});
export const AsyncStorage = tryRequire(() => require('@react-native-async-storage/async-storage').default);
export const Location = tryRequire(() => require('expo-location'));
export const Calendar = tryRequire(() => require('expo-calendar'));
export const Haptics = tryRequire(() => require('expo-haptics'));
export const AuthSession = tryRequire(() => require('expo-auth-session'));
export const WebBrowser = tryRequire(() => {
  const W = require('expo-web-browser');
  W.maybeCompleteAuthSession();
  return W;
});
export const AppleAuth = Platform.OS === 'ios' ? tryRequire(() => require('expo-apple-authentication')) : null;
export const Crypto = tryRequire(() => require('expo-crypto'));
export const MobileAds = Platform.OS === 'web' ? null : tryRequire(() => require('react-native-google-mobile-ads'));
export const Tracking = Platform.OS === 'ios' ? tryRequire(() => require('expo-tracking-transparency')) : null;
export const Purchases = Platform.OS === 'web' ? null : tryRequire(() => require('react-native-purchases').default);
export const AppleTargets = Platform.OS === 'ios' ? tryRequire(() => require('@bacons/apple-targets')) : null;
export const Camera = Platform.OS === 'web' ? null : tryRequire(() => require('expo-camera'));
export const TaskManager = Platform.OS === 'web' ? null : tryRequire(() => require('expo-task-manager'));
export const QRCode = tryRequire(() => require('react-native-qrcode-svg').default);
export const Constants = tryRequire(() => require('expo-constants').default);
export const ImageManipulator = tryRequire(() => require('expo-image-manipulator'));

export function tap(kind = 'light') {
  if (!Haptics) return;
  const map = {
    light: Haptics.ImpactFeedbackStyle?.Light,
    medium: Haptics.ImpactFeedbackStyle?.Medium,
  };
  if (kind === 'success') { Haptics.notificationAsync?.(Haptics.NotificationFeedbackType?.Success).catch(() => {}); return; }
  Haptics.impactAsync?.(map[kind] || map.light).catch(() => {});
}
