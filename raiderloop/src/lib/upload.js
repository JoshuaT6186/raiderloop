/**
 * Picking and preparing photos and files before they go up.
 * Photos are shrunk to 1600 px JPEGs first: smaller uploads, faster
 * moderation, and no HEIC surprises.
 */
import { ImagePicker, ImageManipulator, DocumentPicker } from './native';
import { uploadLocalFile } from './firebase';

export class PickError extends Error {}

async function shrink(uri, maxSide = 1600, base64 = false) {
  if (!ImageManipulator) return { uri, base64: null };
  try {
    if (ImageManipulator.manipulateAsync) {
      const r = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: maxSide } }], { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG, base64 });
      return { uri: r.uri, base64: r.base64 || null };
    }
    const ctx = ImageManipulator.ImageManipulator.manipulate(uri);
    ctx.resize({ width: maxSide });
    const img = await ctx.renderAsync();
    const r = await img.saveAsync({ compress: 0.72, format: ImageManipulator.SaveFormat.JPEG, base64 });
    return { uri: r.uri, base64: r.base64 || null };
  } catch (e) {
    return { uri, base64: null };
  }
}

/** Opens the camera or the photo library. Returns null if cancelled. */
export async function pickPhoto({ camera = false, base64 = false, maxSide = 1600 } = {}) {
  if (!ImagePicker) throw new PickError("Photos aren't available in this build.");
  if (camera) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new PickError('Camera access is off for Flyer. You can turn it on in Settings, or pick a photo instead.');
  }
  const opts = { mediaTypes: ['images'], quality: 0.85, exif: false };
  const result = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (!result || result.canceled || !result.assets || !result.assets[0]) return null;
  const a = result.assets[0];
  const small = await shrink(a.uri, Math.min(maxSide, a.width || maxSide), base64);
  return { uri: small.uri, base64: small.base64, width: a.width, height: a.height, contentType: 'image/jpeg' };
}

/** Pick a PDF (or an image) from Files. */
export async function pickDocument({ types = ['application/pdf', 'image/*'] } = {}) {
  if (!DocumentPicker) throw new PickError("Files aren't available in this build.");
  const r = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true, multiple: false });
  if (!r || r.canceled || !r.assets || !r.assets[0]) return null;
  const a = r.assets[0];
  let contentType = a.mimeType || (/\.pdf$/i.test(a.name || '') ? 'application/pdf' : 'image/jpeg');
  let { uri } = a;
  if (contentType.startsWith('image/')) { const s = await shrink(uri); uri = s.uri; contentType = 'image/jpeg'; }
  if (a.size && a.size > 24 * 1024 * 1024) throw new PickError('That file is over 24 MB. Try a smaller one.');
  return { uri, name: a.name || 'file', size: a.size || 0, contentType };
}

/** Upload something picked above; returns the uploads/… path. */
export async function upload(file) {
  return uploadLocalFile(file.uri, file.contentType || 'image/jpeg');
}

/** A friendly message for anything that goes wrong on the way up. */
export function uploadError(e) {
  if (e instanceof PickError) return e.message;
  if (e?.code === 'functions/resource-exhausted' || e?.code === 'functions/invalid-argument' || e?.code === 'functions/failed-precondition' || e?.code === 'functions/permission-denied' || e?.code === 'functions/not-found') return e.message;
  if (/network/i.test(String(e?.message))) return "Can't reach the server. Check your connection and try again.";
  return e?.message || 'Something went wrong. Try again.';
}
