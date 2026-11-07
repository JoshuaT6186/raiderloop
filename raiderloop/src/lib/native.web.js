/**
 * Optional native modules, web edition.
 * Metro uses this file instead of native.js when building for the
 * browser, so phone-only packages (maps, Health, ads, purchases,
 * widgets, Wallet, camera, location, Keychain) are never bundled for
 * the web at all. Every feature that needs one of them already shows
 * a friendly "not on the web" state when it gets null here.
 */
function tryRequire(fn) {
  try { return fn(); } catch (e) { return null; }
}

export const SvgLib = tryRequire(() => require('react-native-svg'));
export const Maps = null;
export const ImagePicker = tryRequire(() => require('expo-image-picker'));
export const Notifications = null;
export const AsyncStorage = tryRequire(() => require('@react-native-async-storage/async-storage').default);
export const Location = null;
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
export const DocumentPicker = tryRequire(() => require('expo-document-picker'));
export const ImageManipulator = tryRequire(() => require('expo-image-manipulator'));
export const SecureStore = null;
export const KeepAwake = tryRequire(() => require('expo-keep-awake'));
export const Constants = tryRequire(() => require('expo-constants').default);
export const AltIcons = null;
export const HealthKit = null;
export const Clipboard = tryRequire(() => require('expo-clipboard'));

export function tap() { /* no haptics in a browser */ }
