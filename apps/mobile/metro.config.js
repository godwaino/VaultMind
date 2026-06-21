// Metro config for the monorepo: watch the workspace root so the shared
// @vaultmind/* TypeScript packages resolve, and let Metro follow symlinks.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// Resolve `.js` import specifiers in the shared TS packages to their .ts sources.
config.resolver.sourceExts = [...config.resolver.sourceExts, "ts", "tsx"];

module.exports = config;
