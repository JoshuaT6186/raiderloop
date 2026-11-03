/**
 * App Review (Guideline 2.5.4): Flyer never uses location in the
 * background, so "location" must never appear in UIBackgroundModes.
 *
 * expo-location only adds it when isIosBackgroundLocationEnabled is
 * true (it's false in app.json), but another library or an old
 * setting could still slip it in. This plugin removes it twice:
 *   1. from the Info.plist mod (listed first in app.json, so its mod
 *      runs after the other plugins' mods), and
 *   2. from the Info.plist file on disk once everything else is done.
 * Safe Walk, friend sharing and Flyer Drop all work while the app is
 * open, which is what we tell people in the app.
 */
const fs = require('fs');
const path = require('path');
const { withInfoPlist, withFinalizedMod } = require('expo/config-plugins');

function strip(plist) {
  if (Array.isArray(plist.UIBackgroundModes)) {
    plist.UIBackgroundModes = plist.UIBackgroundModes.filter((m) => m !== 'location');
    if (!plist.UIBackgroundModes.length) delete plist.UIBackgroundModes;
  }
  return plist;
}

module.exports = function withNoBackgroundLocation(config) {
  config = withInfoPlist(config, (c) => { c.modResults = strip(c.modResults); return c; });
  config = withFinalizedMod(config, ['ios', async (c) => {
    try {
      const file = path.join(c.modRequest.platformProjectRoot, c.modRequest.projectName, 'Info.plist');
      if (fs.existsSync(file)) {
        // eslint-disable-next-line global-require
        const plist = require('@expo/plist').default || require('@expo/plist');
        const data = plist.parse(fs.readFileSync(file, 'utf8'));
        const before = JSON.stringify(data.UIBackgroundModes || []);
        strip(data);
        if (before !== JSON.stringify(data.UIBackgroundModes || [])) fs.writeFileSync(file, plist.build(data));
      }
    } catch (e) {
      // The Info.plist mod above already handled it; this pass is a backstop.
    }
    return c;
  }]);
  return config;
};
