/**
 * Shrinks a picked photo before it's uploaded or sent to Pilot.
 * Phone cameras take 12–48 MP pictures; the AI services that read
 * them reject images over 5 MB, and smaller photos send faster on
 * campus Wi-Fi. Longest side becomes 1600 px, saved as JPEG.
 */
import { ImageManipulator } from './native';

const MAX = 1600;

export async function preparePhoto(asset, { base64 = false } = {}) {
  if (!asset) return null;
  const w = asset.width || 0; const h = asset.height || 0;
  if (!ImageManipulator) return { uri: asset.uri, base64: asset.base64 || null, width: w, height: h, mimeType: asset.mimeType || 'image/jpeg' };
  const actions = w >= h ? (w > MAX ? [{ resize: { width: MAX } }] : []) : (h > MAX ? [{ resize: { height: MAX } }] : []);
  const out = await ImageManipulator.manipulateAsync(asset.uri, actions, { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64 });
  return { uri: out.uri, base64: out.base64 || null, width: out.width, height: out.height, mimeType: 'image/jpeg' };
}
