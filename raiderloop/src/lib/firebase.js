/**
 * Firebase — app, auth, Firestore, and callable functions.
 * ------------------------------------------------------------
 * Every callable now requires a signed-in user (a guest is an
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
  linkWithCredential, EmailAuthProvider, deleteUser,
} from 'firebase/auth';
import * as FirebaseAuth from 'firebase/auth';
import {
  getFirestore, doc, onSnapshot, collection, query, where,
} from 'firebase/firestore';
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
const functions = getFunctions(app);

const call = (name) => {
  const fn = httpsCallable(functions, name);
  return async (data) => {
    if (!auth.currentUser) await signInAnonymously(auth);
    return fn(data);
  };
};

export const api = {
  askPilot: call('askPilot'),
  parseSchedule: call('parseSchedule'),
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
  saveProfile: call('saveProfile'),
  sendFriendRequest: call('sendFriendRequest'),
  respondFriendRequest: call('respondFriendRequest'),
  removeFriend: call('removeFriend'),
  blockUser: call('blockUser'),
  updateLocation: call('updateLocation'),
  stopSharing: call('stopSharing'),
  setClassmateOptIn: call('setClassmateOptIn'),
  findClassmates: call('findClassmates'),
  getSponsors: call('getSponsors'),
  canvasExchange: call('canvasExchange'),
  canvasSync: call('canvasSync'),
  canvasDisconnect: call('canvasDisconnect'),
  getUsage: call('getUsage'),
  deleteAccount: call('deleteAccount'),
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
export async function appleSignIn(AppleAuth, Crypto) {
  const raw = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  const res = await AppleAuth.signInAsync({
    requestedScopes: [AppleAuth.AppleAuthenticationScope.FULL_NAME, AppleAuth.AppleAuthenticationScope.EMAIL],
    nonce: hashed,
  });
  const provider = new OAuthProvider('apple.com');
  const credential = provider.credential({ idToken: res.identityToken, rawNonce: raw });
  const cur = auth.currentUser;
  const result = cur && cur.isAnonymous
    ? await linkWithCredential(cur, credential).catch(() => signInWithCredential(auth, credential))
    : await signInWithCredential(auth, credential);
  const name = [res.fullName?.givenName, res.fullName?.familyName].filter(Boolean).join(' ');
  if (name && !result.user.displayName) await updateProfile(result.user, { displayName: name }).catch(() => {});
  return { user: result.user, name };
}

export async function deleteMyAccount() {
  await api.deleteAccount({}).catch(() => {});
  if (auth.currentUser) await deleteUser(auth.currentUser).catch(() => {});
}

/* ---------- Firestore live listeners ---------- */
export function listenMyProfile(uid, cb) {
  return onSnapshot(doc(db, 'users', uid), (s) => cb(s.exists() ? s.data() : null), () => cb(null));
}
export function listenFriends(uid, cb) {
  return onSnapshot(collection(db, 'users', uid, 'friends'), (s) => cb(s.docs.map((d) => ({ uid: d.id, ...d.data() }))), () => cb([]));
}
export function listenRequests(uid, cb) {
  return onSnapshot(collection(db, 'users', uid, 'requests'), (s) => cb(s.docs.map((d) => ({ uid: d.id, ...d.data() }))), () => cb([]));
}
/* Only returns locations whose owner has put me in their `allowed`
   list — enforced by Firestore rules, not just this query. */
export function listenFriendLocations(uid, cb) {
  const q = query(collection(db, 'locations'), where('allowed', 'array-contains', uid));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ uid: d.id, ...d.data() }))), () => cb([]));
}
