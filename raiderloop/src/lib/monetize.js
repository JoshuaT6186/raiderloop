/**
 * Money: ads, Flyer Plus, affiliate links.
 * ------------------------------------------------------------
 * Rules this file enforces:
 *  • Ads start on Google's TEST IDs (config.ADS.useTestIds).
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
    adsReady = true;
  } catch (e) { adsReady = false; }
}

export function BannerAd({ isPlus, style }) {
  const [failed, setFailed] = useState(false);
  if (isPlus || !MobileAds || !ADS.enabled || !adsReady || failed) return null;
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
  const info = await Purchases.restorePurchases();
  return !!info.entitlements.active[PURCHASES.entitlement];
}

export function usePlusStatus(user, onChange) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await initPurchases(user && !user.isAnonymous ? user.uid : null);
      const plus = await checkPlus();
      if (!cancelled && plus !== null) onChange(plus);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);
}

/* ---------- Affiliate ---------- */
export function affiliateSearchUrl(q) {
  const base = `https://www.amazon.com/s?k=${encodeURIComponent(q)}`;
  return AFFILIATE.amazonTag ? `${base}&tag=${encodeURIComponent(AFFILIATE.amazonTag)}` : base;
}
export const isAffiliate = () => !!AFFILIATE.amazonTag;
