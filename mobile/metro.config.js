const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('sql'); // drizzle migrations
config.resolver.assetExts.push('wasm'); // expo-sqlite on web

module.exports = config;
