// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
// The offline dictionary pack ships as a bundled asset.
config.resolver.assetExts.push("sqlite");

module.exports = config;
