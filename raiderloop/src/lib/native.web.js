/**
 * Web build of the native-module loader.
 * ------------------------------------------------------------
 * Metro picks this file instead of native.js when bundling for the
 * browser, so native-only packages (maps, ads, purchases, widget,
 * notifications, calendar, Apple sign-in) are never pulled into the
 * web bundle. The web preview is for looking at the design; those
 * features show their normal "not available in this build" state.
 * Phones use native.js and get everything.
 */
function tryRequire(fn) {
  try { return fn(); } catch (e) { return null; }
}

export const SvgLib = tryRequire(() => require('react-native-svg'));
export const Maps = null;
export const ImagePicker = tryRequire(() => require('expo-image-picker'));
export const Notifications = null;
export const AsyncStorage = tryRequire(() => require('@react-native-async-storage/async-storage').default);
export const Location = tryRequire(() => require('expo-location'));
export const Calendar = null;
export const Haptics = null;
export const AuthSession = tryRequire(() => require('expo-auth-session'));
export const WebBrowser = tryRequire(() => {
  const W = require('expo-web-browser');
  W.maybeCompleteAuthSession();
  return W;
});
export const AppleAuth = null;
export const Crypto = tryRequire(() => require('expo-crypto'));
export const MobileAds = null;
export const Tracking = null;
export const Purchases = null;
export const AppleTargets = null;
export const Camera = null;
export const TaskManager = null;
export const QRCode = tryRequire(() => require('react-native-qrcode-svg').default);
export const Constants = tryRequire(() => require('expo-constants').default);
export const ImageManipulator = tryRequire(() => require('expo-image-manipulator'));

export function tap() {}
