// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
// The offline dictionary pack ships as a bundled asset.
config.resolver.assetExts.push("sqlite");
// expo-sqlite on web runs wa-sqlite.
config.resolver.assetExts.push("wasm");

// expo-sqlite's sync calls on web need SharedArrayBuffer, so the page must be cross-origin isolated.
// require-corp, not credentialless: Safari supports only the former.
const enhance = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const next = enhance ? enhance(middleware, server) : middleware;
  return (req, res, done) => {
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    return next(req, res, done);
  };
};

module.exports = config;
