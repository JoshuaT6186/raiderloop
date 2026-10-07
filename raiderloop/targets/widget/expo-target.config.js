/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'FlyerWidget',
  icon: '../../assets/icon.png',
  colors: {
    $widgetBackground: { light: '#FBF7EC', dark: '#1E2A25' },
    $accent: { light: '#2F5DA8', dark: '#9CCBFF' },
    Ink: { light: '#1F2A44', dark: '#F4F1E6' },
    Note: { light: '#FFEB85', dark: '#F1DE78' },
  },
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
  deploymentTarget: '17.0',
});
