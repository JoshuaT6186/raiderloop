/**
 * Firebase — app, auth, Firestore, Storage uploads, and callable
 * functions.
 * ------------------------------------------------------------
 * Every callable requires a signed-in user (a guest is an anonymous
 * Firebase user). That one change is what lets the server rate-limit
 * per person and stops random scripts from spending your
 * Anthropic/Tavily credits by hitting the endpoints directly.
 *
 * Uploads only ever go to uploads/{uid}/…; a function checks and
 * moderates each one before anyone else can see it (storage.rules).
 *
 * Deliberately does NOT import firebase/analytics: it depends on
 * browser-only APIs and crashes on a real device.
 */
import { Platform } from 'react-native';
import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth, getAuth, onAuthStateChanged, signInAnonymously,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as fbSignOut,
  sendPasswordResetEmail, updateProfile, OAuthProvider, signInWithCredential,
  linkWithCredential, EmailAuthProvider, deleteUser,
} from 'firebase/auth';
import * as FirebaseAuth from 'firebase/auth';
import {
  getFirestore, doc, onSnapshot, collection, query, where, orderBy, limit,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getStorage, ref as storageRef, uploadBytes } from 'firebase/storage';
import { FIREBASE_CONFIG } from '../config';
import { AsyncStorage, Constants } from './native';

export const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);

/* React Native persistence keeps people signed in across launches.
   getReactNativePersistence only exists in the RN build of
   firebase/auth, so it's looked up defensively. */
function makeAuth() {
  try {
    const rnPersist = FirebaseAuth.getReactNativePersistence;
    if (rnPersist && AsyncStorage) {
      return initializeAuth(app, { persistence: rnPersist(AsyncStorage) });
    }
  } catch (e) { /* already initialized (fast refresh) */ }
  return getAuth(app);
}
export const auth = makeAuth();
export const db = getFirestore(app);
const functions = getFunctions(app);
const storage = getStorage(app);

const call = (name) => {
  const fn = httpsCallable(functions, name, { timeout: 120000 });
  const wrapped = async (data) => {
    if (!auth.currentUser) await signInAnonymously(auth);
    return fn(data);
  };
  wrapped.callableName = name; // lets useCallable keep an offline copy
  return wrapped;
};

const NAMES = [
  // 1.x
  'askPilot', 'parseSchedule', 'getEvents', 'getNews', 'getSportsSchedule', 'getDiningMenus', 'getCampusAlerts', 'enrichOrg',
  'getVenueImage', 'getDiningHallDetail', 'getParking', 'getFinals', 'requestSchool', 'saveProfile', 'sendFriendRequest',
  'respondFriendRequest', 'removeFriend', 'blockUser', 'updateLocation', 'stopSharing', 'setClassmateOptIn', 'findClassmates',
  'getSponsors', 'canvasExchange', 'canvasSync', 'canvasDisconnect', 'getUsage', 'deleteAccount',
  // Campus hub
  'getJobs', 'getCourse', 'getDeals', 'voteDeal', 'suggestDeal',
  // Connect
  'savePushToken', 'saveCard', 'getCard', 'setFacePhoto', 'walletLink', 'setSayHi', 'getSayHi', 'sendSayHi', 'respondSayHi',
  'faceSwap', 'faceSwapStatus', 'dropBeacon', 'dropSend', 'dropClaim', 'dropDismiss', 'createShare', 'getShare', 'report',
  'amIAdmin', 'adminQueue', 'adminAction', 'claimOrg', 'myOrgs', 'reportOutdated', 'myData', 'deleteMyData',
  // Posts + places
  'createPost', 'savePost', 'deletePost', 'getStory', 'setPrivacyPrefs', 'createPublicPost', 'deletePublicPost', 'markHelpful',
  'setGoing', 'tapStatus', 'shareNotes', 'getClassNotes', 'askNotes',
  // Together
  'groupCreate', 'groupJoin', 'groupLeave', 'groupAction', 'planCreate', 'planVote', 'planClose', 'queueOpen', 'queueJoin',
  'queueLeave', 'queueNext', 'queueClose', 'presentClaim', 'presentShow', 'presentNav', 'presentEnd', 'walkStart', 'walkUpdate',
  'walkCheckIn', 'walkEnd', 'walkSOS',
  // Play
  'getPlay', 'setLeaderboard', 'getLeaderboard', 'checkIn', 'gameCreate', 'gameJoin', 'gameStart', 'gameMyCode', 'gamePing',
  'gameHint', 'gameFound', 'gameEnd',
  // Tools
  'scanFlyer', 'parseSyllabus', 'getDegreePlan', 'getMajor', 'getAround', 'canvaExchange', 'canvaDesigns', 'canvaDisconnect',
  'smsStart', 'smsConfirm', 'smsDisconnect', 'saveSmsContext',
];
export const api = Object.fromEntries(NAMES.map((n) => [n, call(n)]));

/* Logging never signs anyone in, so a failed sign-in can still be
   recorded for debugging (it's how App Review problems get found). */
const logFn = httpsCallable(functions, 'logClientError');
export function logClientError(where, e) {
  const version = Constants?.expoConfig?.version || '';
  logFn({
    where, code: String(e?.code || ''), message: String(e?.message || e || '').slice(0, 500),
    platform: Platform.OS, os: String(Platform.Version || ''), app: version,
  }).catch(() => {});
}

/* ---------- uploads ---------- */
const rid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
/** Uploads a local file (photo or PDF) to uploads/{uid}/… and returns
    the storage path a function will check and publish. */
export async function uploadLocalFile(uri, contentType = 'image/jpeg') {
  if (!auth.currentUser) await signInAnonymously(auth);
  const uid = auth.currentUser.uid;
  const ext = contentType === 'application/pdf' ? 'pdf' : contentType === 'image/png' ? 'png' : 'jpg';
  const path = `uploads/${uid}/${rid()}.${ext}`;
  const res = await fetch(uri);
  const blob = await res.blob();
  await uploadBytes(storageRef(storage, path), blob, { contentType });
  return path;
}

/* ---------- auth helpers ---------- */
export const onAuth = (cb) => onAuthStateChanged(auth, cb);
export const guestSignIn = () => signInAnonymously(auth);

/* If someone started as a guest, creating an account LINKS to the
   same uid so their friends and settings carry over. */
export async function emailSignUp(email, password, displayName) {
  const cur = auth.currentUser;
  let cred;
  if (cur && cur.isAnonymous) {
    cred = await linkWithCredential(cur, EmailAuthProvider.credential(email, password));
  } else {
    cred = await createUserWithEmailAndPassword(auth, email, password);
  }
  if (displayName) await updateProfile(cred.user, { displayName }).catch(() => {});
  return cred.user;
}
export const emailSignIn = (email, password) => signInWithEmailAndPassword(auth, email, password).then((c) => c.user);
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);
export const signOut = () => fbSignOut(auth);

/* Plain-English messages for Sign in with Apple, so nobody (App
   Review included) ever sees a raw error code. */
export function appleErrorMessage(e) {
  const c = String(e?.code || '');
  if (/ERR_REQUEST_CANCELED|ERR_CANCELED|canceled/i.test(c)) return null;
  if (c.includes('operation-not-allowed')) return "Apple sign-in isn't available for Flyer right now. Use email, or tap \"Look around first\".";
  if (c.includes('network')) return "Can't reach the server. Check your connection and try again.";
  if (c.includes('invalid-credential') || c.includes('missing-or-invalid-nonce')) return "Apple couldn't confirm the sign-in. Please try again.";
  if (c.includes('account-exists-with-different-credential')) return 'That email already has a Flyer account. Sign in with email instead.';
  if (c.includes('ERR_REQUEST_NOT_HANDLED') || c.includes('ERR_REQUEST_NOT_INTERACTIVE') || c.includes('ERR_REQUEST_UNKNOWN')) return 'Apple sign-in was interrupted. Try again, or use email.';
  if (c.includes('ERR_INVALID_RESPONSE') || c.includes('no-token')) return "Apple didn't send back a sign-in. Try again, or use email.";
  return 'Apple sign-in didn\'t work this time. Try again, or use email.';
}

/* Sign in with Apple → Firebase. The nonce dance is required:
   Apple signs the SHA-256 of the nonce, Firebase checks the raw one.
   If this phone was a guest, the Apple account is LINKED to the same
   user; if that Apple ID already has a Flyer account, we sign into it
   with the credential Firebase hands back (a nonce can't be reused). */
export async function appleSignIn(AppleAuth, Crypto) {
  let raw;
  try {
    const bytes = Crypto.getRandomBytes ? Crypto.getRandomBytes(32) : null;
    raw = bytes ? Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('') : null;
  } catch (e) { raw = null; }
  if (!raw) raw = `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  const res = await AppleAuth.signInAsync({
    requestedScopes: [AppleAuth.AppleAuthenticationScope.FULL_NAME, AppleAuth.AppleAuthenticationScope.EMAIL],
    nonce: hashed,
  });
  if (!res || !res.identityToken) { const err = new Error('Apple returned no identity token'); err.code = 'no-token'; throw err; }
  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({ idToken: res.identityToken, rawNonce: raw });
  const cur = auth.currentUser;
  let result;
  try {
    if (cur && cur.isAnonymous) {
      try {
        result = await linkWithCredential(cur, credential);
      } catch (e) {
        const code = String(e?.code || '');
        if (code.includes('credential-already-in-use') || code.includes('email-already-in-use') || code.includes('provider-already-linked')) {
          const again = OAuthProvider.credentialFromError ? OAuthProvider.credentialFromError(e) : null;
          result = await signInWithCredential(auth, again || credential);
        } else throw e;
      }
    } else {
      result = await signInWithCredential(auth, credential);
    }
  } catch (e) {
    logClientError('appleSignIn', e);
    throw e;
  }
  const name = [res.fullName?.givenName, res.fullName?.familyName].filter(Boolean).join(' ');
  if (name && !result.user.displayName) await updateProfile(result.user, { displayName: name }).catch(() => {});
  return { user: result.user, name: name || result.user.displayName || '' };
}

export async function deleteMyAccount() {
  await api.deleteAccount({}).catch(() => {});
  if (auth.currentUser) await deleteUser(auth.currentUser).catch(() => {});
}

/* ---------- Firestore live listeners ---------- */
const docs = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
export function listenMyProfile(uid, cb) {
  return onSnapshot(doc(db, 'users', uid), (s) => cb(s.exists() ? s.data() : null), () => cb(null));
}
export function listenFriends(uid, cb) {
  return onSnapshot(collection(db, 'users', uid, 'friends'), (s) => cb(s.docs.map((d) => ({ uid: d.id, ...d.data() }))), () => cb([]));
}
export function listenRequests(uid, cb) {
  return onSnapshot(collection(db, 'users', uid, 'requests'), (s) => cb(s.docs.map((d) => ({ uid: d.id, ...d.data() }))), () => cb([]));
}
export function listenBlocked(uid, cb) {
  return onSnapshot(collection(db, 'users', uid, 'blocked'), (s) => cb(s.docs.map((d) => d.id)), () => cb([]));
}
/* Only returns locations whose owner has put me in their `allowed`
   list — enforced by Firestore rules, not just this query. */
export function listenFriendLocations(uid, cb) {
  const q = query(collection(db, 'locations'), where('allowed', 'array-contains', uid));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ uid: d.id, ...d.data() }))), () => cb([]));
}
export function listenIntros(uid, cb) {
  return onSnapshot(collection(db, 'users', uid, 'intros'), (s) => cb(s.docs.map((d) => ({ uid: d.id, ...d.data() }))), () => cb([]));
}
export function listenFeed(uid, cb) {
  return onSnapshot(collection(db, 'users', uid, 'feed'), (s) => cb(docs(s)), () => cb([]));
}
export function listenFriendPostcards(uid, cb) {
  return onSnapshot(collection(db, 'users', uid, 'postcards'), (s) => cb(docs(s)), () => cb([]));
}
export function listenMyPosts(uid, cb) {
  const q = query(collection(db, 'posts'), where('uid', '==', uid), orderBy('createdMs', 'desc'), limit(300));
  return onSnapshot(q, (s) => cb(docs(s)), () => cb([]));
}
export function listenMyCard(uid, cb) {
  return onSnapshot(doc(db, 'cards', uid), (s) => cb(s.exists() ? s.data() : null), () => cb(null));
}
export function listenDrops(uid, cb) {
  const q = query(collection(db, 'drops'), where('recipients', 'array-contains', uid), orderBy('createdAt', 'desc'), limit(40));
  return onSnapshot(q, (s) => cb(docs(s)), () => cb([]));
}
export function listenGroups(uid, cb) {
  return onSnapshot(query(collection(db, 'groups'), where('members', 'array-contains', uid)), (s) => cb(docs(s)), () => cb([]));
}
export function listenGroupInvites(uid, cb) {
  return onSnapshot(query(collection(db, 'groups'), where('invited', 'array-contains', uid)), (s) => cb(docs(s)), () => cb([]));
}
export function listenWatching(uid, cb) {
  return onSnapshot(query(collection(db, 'walks'), where('watchers', 'array-contains', uid)), (s) => cb(docs(s).filter((w) => ['active', 'overdue', 'sos'].includes(w.status))), () => cb([]));
}
export function listenDoc(path, cb) {
  return onSnapshot(doc(db, ...path.split('/')), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null), () => cb(null));
}
export function listenScore(uid, cb) {
  return onSnapshot(doc(db, 'scores', uid), (s) => cb(s.exists() ? s.data() : null), () => cb(null));
}
export function listenPublic(kind, cb, max = 60) {
  const order = kind === 'event' ? orderBy('when', 'asc') : kind === 'tip' ? orderBy('helpful', 'desc') : orderBy('createdMs', 'desc');
  const q = query(collection(db, 'publicPosts'), where('kind', '==', kind), where('status', '==', 'live'), order, limit(max));
  return onSnapshot(q, (s) => cb(docs(s).filter((p) => !p.expiresAt || new Date(p.expiresAt) > new Date())), () => cb([]));
}
/** Places with a status tap in the last 30 minutes (map layer). */
export function listenRecentStatus(cb) {
  const q = query(collection(db, 'status'), where('updatedMs', '>', Date.now() - 30 * 60000), limit(80));
  return onSnapshot(q, (s) => cb(docs(s)), () => cb([]));
}
export function listenMyPublic(uid, cb) {
  return onSnapshot(query(collection(db, 'publicPosts'), where('uid', '==', uid)), (s) => cb(docs(s)), () => cb([]));
}
export function listenQueueEntries(code, cb) {
  return onSnapshot(collection(db, 'queues', code, 'entries'), (s) => cb(docs(s)), () => cb([]));
}
export function listenGames(uid, cb) {
  const a = onSnapshot(query(collection(db, 'games'), where('players', 'array-contains', uid)), (s) => cb('players', docs(s)), () => cb('players', []));
  const b = onSnapshot(query(collection(db, 'games'), where('invited', 'array-contains', uid)), (s) => cb('invited', docs(s)), () => cb('invited', []));
  return () => { a(); b(); };
}
