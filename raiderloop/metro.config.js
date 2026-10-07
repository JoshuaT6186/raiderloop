// Metro (the app bundler) settings. The Cloud Functions folder has its
// own node_modules for the server; the app never uses them, so Metro is
// told to skip them. The app DOES read the shared JSON files in
// functions/src/shared, which is why that folder isn't skipped.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const prev = config.resolver.blockList;
const list = Array.isArray(prev) ? prev : prev ? [prev] : [];
config.resolver.blockList = [...list, /[/\\]functions[/\\]node_modules[/\\].*/];

module.exports = config;
