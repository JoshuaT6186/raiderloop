/**
 * Money: ads, Flyer Plus, affiliate links.
 * ------------------------------------------------------------
 * Rules this file enforces:
 *  • config.ADS.useTestIds switches between Google's test ads and the
 *    real ad unit. Release builds use the real unit: never tap your own ads.
 *  • iOS asks App Tracking Transparency once; if declined, ads are
 *    non-personalized. Either way nothing about location, schedule
 *    or friends is ever passed to an ad network.
 *  • Flyer Plus removes ads entirely.
 *  • Every sponsored or affiliate item is visibly labeled.
 */
import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { MobileAds, Tracking, Purchases } from './native';
import { ADS, PURCHASES, AFFILIATE } from '../config';

let adsReady = false; let personalized = false;
/* Banners listen for init finishing, so one rendered too early still shows. */
const adsListeners = new Set();
function setAdsReady(v) { adsReady = v; adsListeners.forEach((f) => f(v)); }

export async function initAds({ askTracking }) {
  if (!MobileAds || !ADS.enabled) return;
  try {
    if (Tracking && askTracking) {
      const { status } = await Tracking.requestTrackingPermissionsAsync();
      personalized = status === 'granted';
    } else if (Tracking) {
      const { status } = await Tracking.getTrackingPermissionsAsync();
      personalized = status === 'granted';
    }
    await MobileAds.default().setRequestConfiguration({
      tagForChildDirectedTreatment: false,
      maxAdContentRating: MobileAds.MaxAdContentRating?.T || 'T',
    });
    await MobileAds.default().initialize();
    setAdsReady(true);
  } catch (e) { setAdsReady(false); }
}

export function BannerAd({ isPlus, style }) {
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(adsReady);
  useEffect(() => {
    adsListeners.add(setReady); setReady(adsReady);
    return () => { adsListeners.delete(setReady); };
  }, []);
  if (isPlus || !MobileAds || !ADS.enabled || !ready || failed) return null;
  const { BannerAd: GBanner, BannerAdSize, TestIds } = MobileAds;
  const unitId = ADS.useTestIds ? TestIds.ADAPTIVE_BANNER || TestIds.BANNER : Platform.select({ ios: ADS.bannerIos, android: ADS.bannerAndroid });
  return (
    <View style={[{ alignItems: 'center', marginVertical: 12 }, style]}>
      <GBanner
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER || BannerAdSize.BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: !personalized }}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

/* ---------- Flyer Plus (RevenueCat) ---------- */
let purchasesReady = false;
export async function initPurchases(appUserId) {
  if (!Purchases) return false;
  const apiKey = Platform.select({ ios: PURCHASES.iosKey, android: PURCHASES.androidKey });
  if (!apiKey) return false;
  try {
    if (!purchasesReady) { Purchases.configure({ apiKey, appUserID: appUserId || null }); purchasesReady = true; }
    else if (appUserId) await Purchases.logIn(appUserId);
    else if (!(await Purchases.isAnonymous())) await Purchases.logOut(); // a guest never inherits the last account's Plus
    return true;
  } catch (e) { return false; }
}
export const purchasesAvailable = () => !!Purchases && purchasesReady;

/* true / false when RevenueCat answered; null when it couldn't (offline,
   not configured). The caller keeps the saved value on null, so someone
   who paid isn't shown ads just because the network blipped. */
export async function checkPlus() {
  if (!purchasesAvailable()) return null;
  try {
    const info = await Purchases.getCustomerInfo();
    return !!info.entitlements.active[PURCHASES.entitlement];
  } catch (e) { return null; }
}

export async function getPlusOffering() {
  if (!purchasesAvailable()) return null;
  try {
    const o = await Purchases.getOfferings();
    return o.current || null;
  } catch (e) { return null; }
}

export async function buyPlus(pkg) {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return !!customerInfo.entitlements.active[PURCHASES.entitlement];
}

export async function restorePlus() {
  if (!purchasesAvailable()) throw new Error("Flyer Plus isn't available yet. Check back soon.");
  const info = await Purchases.restorePurchases();
  return !!info.entitlements.active[PURCHASES.entitlement];
}

export function usePlusStatus(user, onChange) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await initPurchases(user && !user.isAnonymous ? user.uid : null);
      if (!ok) return;
      const plus = await checkPlus();
      if (!cancelled && plus !== null) onChange(plus);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, user?.isAnonymous]);
}

/* On sign-out / delete: forget the RevenueCat user so the next person
   on this phone doesn't get their Plus. */
export async function logOutPurchases() {
  if (!purchasesAvailable()) return;
  try { if (!(await Purchases.isAnonymous())) await Purchases.logOut(); } catch (e) { /* already anonymous */ }
}

/* ---------- Affiliate ---------- */
export function affiliateSearchUrl(q) {
  const base = `https://www.amazon.com/s?k=${encodeURIComponent(q)}`;
  return AFFILIATE.amazonTag ? `${base}&tag=${encodeURIComponent(AFFILIATE.amazonTag)}` : base;
}
export const isAffiliate = () => !!AFFILIATE.amazonTag;
