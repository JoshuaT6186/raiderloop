const { withXcodeProject } = require('expo/config-plugins');
module.exports = (config) =>
  withXcodeProject(config, (cfg) => {
    try {
      const section = cfg.modResults.pbxXCBuildConfigurationSection();
      let touched = 0;
      for (const key of Object.keys(section)) {
        const bs = section[key] && section[key].buildSettings;
        if (!bs) continue;
        const name = String(bs.ASSETCATALOG_COMPILER_APPICON_NAME || '').replace(/"/g, '');
        if (name === 'iMessage App Icon') {
          bs.ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS = 'YES';
          touched += 1;
        }
      }
      console.log('[withMessagesIcons] updated ' + touched + ' build configuration(s)');
    } catch (e) {
      console.warn('[withMessagesIcons] skipped:', e && e.message);
    }
    return cfg;
  });
