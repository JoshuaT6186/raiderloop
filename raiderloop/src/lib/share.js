/**
 * Sharing to Messages (or anywhere): Flyer makes a short link with a
 * real preview card, so friends without the app still see the event,
 * and friends with the app land right on it.
 */
import { Share, Platform } from 'react-native';
import { api } from './firebase';
import { metaLine } from './time';

export async function shareThing(kind, data, { message } = {}) {
  let url = '';
  try {
    const r = await api.createShare({ kind, data });
    url = r?.data?.url || '';
  } catch (e) { url = ''; }
  const text = message || [data.title, metaLine(data.when, data.where)].filter(Boolean).join(' · ');
  const body = url ? `${text}\n${url}` : `${text} (via Flyer)`;
  // On iPhone, passing `url` lets Messages build the rich preview.
  return Share.share(Platform.OS === 'ios' && url ? { message: text, url } : { message: body }).catch(() => {});
}

export function shareUrl(url, text = '') {
  return Share.share(Platform.OS === 'ios' ? { message: text, url } : { message: `${text}\n${url}` }).catch(() => {});
}
