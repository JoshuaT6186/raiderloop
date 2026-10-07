import { Linking, Platform, Share } from 'react-native';
import { WebBrowser } from './native';

export function openUrl(url) {
  if (!url) return;
  if (WebBrowser && /^https?:/.test(url)) { WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url)); return; }
  Linking.openURL(url).catch(() => {});
}

export function call(phone) {
  Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => {});
}

/* Hands off to the phone's own Maps app for walking directions. */
export function openDirections(place) {
  if (!place || place.lat == null) return;
  const label = encodeURIComponent(place.name || 'Destination');
  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${place.lat},${place.lng}&dirflg=w&q=${label}`,
    android: `google.navigation:q=${place.lat},${place.lng}&mode=w`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&travelmode=walking`,
  });
  Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&travelmode=walking`));
}

export function shareText(message) {
  return Share.share({ message }).catch(() => {});
}
