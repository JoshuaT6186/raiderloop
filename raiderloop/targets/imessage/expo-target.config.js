/**
 * Flyer in Messages: the app drawer in iMessage.
 *  • Plan polls that live in the conversation (tap to vote; the bubble
 *    updates for everyone).
 *  • Share an event you saved or are going to, as a link with a preview.
 * Reads the list of events from the shared App Group (src/lib/widget.js
 * writes it). No account or network needed for polls.
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = (config) => ({
  type: 'imessage',
  name: 'FlyerMessages',
  displayName: 'Flyer',
  bundleIdentifier: '.imessage',
  colors: {
    Ink: { light: '#1F2A44', dark: '#F4F1E6' },
    Note: { light: '#FFEB85', dark: '#F1DE78' },
    Paper: { light: '#FBF7EC', dark: '#1E2A25' },
    Accent: { light: '#2F5DA8', dark: '#9CCBFF' },
  },
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
  deploymentTarget: '17.0',
});
