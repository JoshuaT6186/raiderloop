/**
 * Firebase — app, auth, Firestore, Storage, and callable functions.
 * ------------------------------------------------------------
 * Every callable requires a signed-in user (a guest is an
 * anonymous Firebase user). That one change is what lets the server
 * rate-limit per person and stops random scripts from spending your
 * Anthropic/Tavily credits by hitting the endpoints directly.
 *
 * Deliberately does NOT import firebase/analytics: it depends on
 * browser-only APIs and crashes on a real device.
 */
import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth, getAuth, onAuthStateChanged, signInAnonymously,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as fbSignOut,
  sendPasswordResetEmail, updateProfile, OAuthProvider, signInWithCredential,
  linkWithCredential, EmailAuthProvider, sendEmailVerification, verifyBeforeUpdateEmail,
  reauthenticateWithCredential, revokeAccessToken,
} from 'firebase/auth';
import * as FirebaseAuth from 'firebase/auth';
import {
  getFirestore, doc, onSnapshot, collection, query, where, orderBy, limit, getDoc,
} from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { FIREBASE_CONFIG } from '../config';
import { AsyncStorage } from './native';

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
export const storage = getStorage(app);
const functions = getFunctions(app);

/* Wait for the saved sign-in to load before calling the server. This
   matters most for background tasks (nearby alerts): without it, a
   cold start could look signed out and create a brand-new guest. */
async function authReady() {
  if (auth.authStateReady) { await auth.authStateReady(); return; }
  await new Promise((resolve) => { const off = onAuthStateChanged(auth, () => { off(); resolve(); }); });
}

const call = (name, { guestOk = true, timeout = 95000 } = {}) => {
  const fn = httpsCallable(functions, name, { timeout });
  return async (data) => {
    await authReady();
    if (!auth.currentUser) {
      if (!guestOk) throw new Error('Sign in first.');
      await signInAnonymously(auth);
    }
    return fn(data);
  };
};
/* Functions that only make sense for a real account never create a
   guest on the way in. */
const acct = (name) => call(name, { guestOk: false });

export const api = {
  askPilot: call('askPilot', { timeout: 160000 }),
  parseSchedule: call('parseSchedule'),
  parseSyllabus: call('parseSyllabus', { timeout: 250000 }),
  getEvents: call('getEvents'),
  getNews: call('getNews'),
  getSportsSchedule: call('getSportsSchedule'),
  getDiningMenus: call('getDiningMenus'),
  getCampusAlerts: call('getCampusAlerts'),
  enrichOrg: call('enrichOrg'),
  getVenueImage: call('getVenueImage'),
  getDiningHallDetail: call('getDiningHallDetail'),
  getParking: call('getParking'),
  getFinals: call('getFinals'),
  requestSchool: call('requestSchool'),
  getSponsors: call('getSponsors'),
  getUsage: call('getUsage'),
  getTopRated: call('getTopRated'),
  canvasExchange: call('canvasExchange'),
  canvasSync: call('canvasSync'),
  canvasDisconnect: call('canvasDisconnect'),
  deleteAccount: call('deleteAccount'),
  stopSharing: call('stopSharing'),
  // account-only
  saveProfile: acct('saveProfile'),
  sendFriendRequest: acct('sendFriendRequest'),
  setHandle: acct('setHandle'),
  respondFriendRequest: acct('respondFriendRequest'),
  removeFriend: acct('removeFriend'),
  blockUser: acct('blockUser'),
  createFriendCode: acct('createFriendCode'),
  redeemFriendCode: acct('redeemFriendCode'),
  resetFriendCodes: acct('resetFriendCodes'),
  updateLocation: acct('updateLocation'),
  setClassmateOptIn: acct('setClassmateOptIn'),
  findClassmates: acct('findClassmates'),
  reportContent: acct('reportContent'),
  checkIn: acct('checkIn'),
  setFlightPrefs: acct('setFlightPrefs'),
  getFlightBoard: acct('getFlightBoard'),
  rateBuilding: acct('rateBuilding'),
  openDm: acct('openDm'),
  sendMessage: acct('sendMessage'),
  createFlock: acct('createFlock'),
  addFlockMembers: acct('addFlockMembers'),
  removeFlockMember: acct('removeFlockMember'),
  leaveFlock: acct('leaveFlock'),
  renameFlock: acct('renameFlock'),
  deleteFlock: acct('deleteFlock'),
  savePushToken: acct('savePushToken'),
  removePushToken: call('removePushToken', { guestOk: false }),
  setChatMute: acct('setChatMute'),
  createMeetup: acct('createMeetup'),
  respondMeetup: acct('respondMeetup'),
  cancelMeetup: acct('cancelMeetup'),
  meetupCheckIn: acct('meetupCheckIn'),
  autoCheckIn: acct('autoCheckIn'),
  updateScheduleShare: acct('updateScheduleShare'),
  setNearbyPrefs: acct('setNearbyPrefs'),
  nearbyPing: acct('nearbyPing'),
  exportMyData: acct('exportMyData'),
};

/* Friendly text for a failed callable. */
export const errText = (e, fallback = 'Something went wrong. Try again.') => {
  const msg = e && e.message ? String(e.message).replace(/^.*?\): /, '') : '';
  if (!msg || /internal|INTERNAL/.test(msg)) return fallback;
  return msg;
};

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

/* Sign in with Apple → Firebase. The nonce dance is required:
   Apple signs the SHA-256 of the nonce, Firebase checks the raw one. */
async function appleCredential(AppleAuth, Crypto) {
  const raw = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  const res = await AppleAuth.signInAsync({
    requestedScopes: [AppleAuth.AppleAuthenticationScope.FULL_NAME, AppleAuth.AppleAuthenticationScope.EMAIL],
    nonce: hashed,
  });
  const provider = new OAuthProvider('apple.com');
  return { res, credential: provider.credential({ idToken: res.identityToken, rawNonce: raw }) };
}

export async function appleSignIn(AppleAuth, Crypto) {
  const { res, credential } = await appleCredential(AppleAuth, Crypto);
  const cur = auth.currentUser;
  const result = cur && cur.isAnonymous
    ? await linkWithCredential(cur, credential).catch(() => signInWithCredential(auth, credential))
    : await signInWithCredential(auth, credential);
  const name = [res.fullName?.givenName, res.fullName?.familyName].filter(Boolean).join(' ');
  if (name && !result.user.displayName) await updateProfile(result.user, { displayName: name }).catch(() => {});
  return { user: result.user, name };
}

export const isAppleUser = () => !!auth.currentUser?.providerData?.some((p) => p.providerId === 'apple.com');

/* Apple requires apps that offer Sign in with Apple to revoke the
   Apple token when the account is deleted. That needs one fresh
   Apple sign-in to get an authorization code. */
export async function revokeApple(AppleAuth, Crypto) {
  const { res, credential } = await appleCredential(AppleAuth, Crypto);
  if (auth.currentUser) await reauthenticateWithCredential(auth.currentUser, credential).catch(() => {});
  if (res.authorizationCode) await revokeAccessToken(auth, res.authorizationCode);
}

/* Everything server-side (data and sign-in) is deleted by the
   deleteAccount function using the Admin SDK. */
export async function deleteMyAccount() {
  await api.deleteAccount({});
}

/* ---------- School email verification ----------
   Uses Firebase's own verification emails — no extra service. If the
   account email is already the school address, a verification link is
   sent to it. Otherwise the school address becomes the sign-in email
   once the link in it is tapped. */
export async function startSchoolVerification(email) {
  const u = auth.currentUser;
  if (!u || u.isAnonymous) throw new Error('Make an account first.');
  const e = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@ttu\.edu$/.test(e)) throw new Error('Use your @ttu.edu email.');
  if ((u.email || '').toLowerCase() === e) {
    if (u.emailVerified) return { already: true };
    await sendEmailVerification(u);
  } else {
    await verifyBeforeUpdateEmail(u, e);
  }
  return { sent: true };
}
export async function refreshSchoolVerification() {
  const u = auth.currentUser;
  if (!u) return { verified: false };
  try {
    await u.reload();
    await u.getIdToken(true);
  } catch (e) {
    // Changing the sign-in email can end the current session.
    if (/token-expired|invalid-user-token|user-not-found|user-disabled/.test(e.code || '')) return { verified: false, signedOut: true };
  }
  const cur = auth.currentUser;
  return { email: cur?.email || '', verified: !!cur?.emailVerified && /@ttu\.edu$/i.test(cur?.email || '') };
}
export const schoolVerified = () => !!auth.currentUser?.emailVerified && /@ttu\.edu$/i.test(auth.currentUser?.email || '');

/* ---------- Photos ----------
   Uploads a picked photo to chatImages/{chatId}/{myUid}/…, then the
   sendMessage function checks it before anyone can see it. */
export async function uploadChatPhoto(chatId, uri) {
  const me = auth.currentUser?.uid;
  if (!me) throw new Error('Sign in first.');
  const blob = await (await fetch(uri)).blob();
  if (blob.size > 6 * 1024 * 1024) throw new Error('That photo is too big.');
  const path = `chatImages/${chatId}/${me}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  await uploadBytes(storageRef(storage, path), blob, { contentType: blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg' });
  return path;
}
const urlCache = new Map();
export async function photoUrl(path) {
  if (urlCache.has(path)) return urlCache.get(path);
  const url = await getDownloadURL(storageRef(storage, path));
  urlCache.set(path, url);
  return url;
}

/* ---------- Firestore live listeners ---------- */
const docs = (s) => s.docs.map((d) => ({ id: d.id, ...d.data() }));
export function listenMyProfile(uid, cb) {
  return onSnapshot(doc(db, 'users', uid), (s) => cb(s.exists() ? s.data() : null), () => cb(null));
}
export function listenFriends(uid, cb) {
  // Second argument: true once the list really loaded (not an error).
  return onSnapshot(collection(db, 'users', uid, 'friends'), (s) => cb(s.docs.map((d) => ({ uid: d.id, ...d.data() })), true), () => cb([], false));
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
export function listenFlight(uid, cb) {
  return onSnapshot(doc(db, 'flight', uid), (s) => cb(s.exists() ? s.data() : {}), () => cb({}));
}
export function listenMeetups(uid, cb) {
  const q = query(collection(db, 'meetups'), where('members', 'array-contains', uid), where('atMs', '>=', Date.now() - 6 * 3600000), orderBy('atMs', 'asc'), limit(30));
  return onSnapshot(q, (s) => cb(docs(s)), () => cb([]));
}
export function listenChats(uid, cb) {
  const q = query(collection(db, 'chats'), where('members', 'array-contains', uid), orderBy('updatedMs', 'desc'), limit(60));
  return onSnapshot(q, (s) => cb(docs(s)), () => cb([]));
}
export function listenMessages(chatId, cb, n = 80) {
  const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('atMs', 'desc'), limit(n));
  return onSnapshot(q, (s) => cb(docs(s).reverse()), () => cb([]));
}
export function listenPlaceRating(placeId, cb) {
  return onSnapshot(doc(db, 'placeRatings', placeId), (s) => cb(s.exists() ? s.data() : null), () => cb(null));
}
/* A friend's shared schedule: busy blocks always (if they share at
   all), class details only if they chose "full" for me. Rules make a
   "busy" reader's request for the full doc fail, which reads as null. */
export async function getFriendSchedule(friendUid) {
  const [a, b] = await Promise.all([
    getDoc(doc(db, 'schedules', friendUid)).catch(() => null),
    getDoc(doc(db, 'schedulesFull', friendUid)).catch(() => null),
  ]);
  return {
    busy: a && a.exists() ? a.data().busy || [] : null,
    classes: b && b.exists() ? b.data().classes || [] : null,
  };
}
