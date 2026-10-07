/**
 * "Sign in with Canvas" (OAuth2 authorization-code flow).
 * ------------------------------------------------------------
 * Canvas's API Policy forbids asking other users to paste personal
 * access tokens into an app, so OAuth with a Developer Key from TTU's
 * Canvas admins is the only legitimate path at scale. Flow:
 *   1. App opens texastech.instructure.com/login/oauth2/auth in a
 *      browser sheet. The student types their password on Canvas's
 *      own page — Flyer never sees it.
 *   2. Canvas redirects back to flyer://canvas-auth?code=...
 *   3. The code goes to the canvasExchange Cloud Function, which
 *      holds the client secret, swaps it for tokens, and stores them
 *      server-side. The app never holds a Canvas token.
 *   4. canvasSync returns upcoming assignments + current scores.
 * Until CANVAS.clientId is filled in, isCanvasConfigured() is false
 * and the UI shows manual entry instead of a dead button.
 */
import { AuthSession, WebBrowser } from './native';
import { CANVAS, SCHOOLS } from '../config';
import { api } from './firebase';

export const isCanvasConfigured = () => !!CANVAS.clientId && !!AuthSession;

export async function connectCanvas(schoolId = 'ttu') {
  if (!isCanvasConfigured()) throw new Error('Canvas sign-in is waiting on a Developer Key from the university.');
  const domain = (SCHOOLS.find((s) => s.id === schoolId) || SCHOOLS[0]).canvasDomain;
  const redirectUri = AuthSession.makeRedirectUri({ scheme: CANVAS.redirectScheme, path: CANVAS.redirectPath });
  const state = Math.random().toString(36).slice(2);
  const authUrl = `https://${domain}/login/oauth2/auth?client_id=${encodeURIComponent(CANVAS.clientId)}`
    + `&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
    + '&scope=' + encodeURIComponent([
      'url:GET|/api/v1/planner/items',
      'url:GET|/api/v1/users/:user_id/enrollments',
      'url:GET|/api/v1/courses',
    ].join(' '));
  const res = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
  if (res.type !== 'success' || !res.url) throw new Error('Canvas sign-in was cancelled.');
  const params = Object.fromEntries((res.url.split('?')[1] || '').split('&').map((kv) => kv.split('=').map(decodeURIComponent)));
  if (params.state !== state) throw new Error('Canvas sign-in failed a security check. Please try again.');
  if (params.error) throw new Error(`Canvas said: ${params.error_description || params.error}`);
  await api.canvasExchange({ code: params.code, redirectUri, schoolId });
  return syncCanvas();
}

export async function syncCanvas() {
  const res = await api.canvasSync({});
  return res.data || { assignments: [], courses: [] };
}

export async function disconnectCanvas() {
  await api.canvasDisconnect({});
}
