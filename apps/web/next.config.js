/**
 * Next.js config for the VaultMind companion web app (deploys to Vercel).
 * `transpilePackages` lets Next compile the shared TypeScript workspace packages
 * directly (they ship as .ts, not built JS). `output: 'standalone'` keeps the
 * Vercel/Docker image lean if self-hosting.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: [
    "@vaultmind/crypto",
    "@vaultmind/consent",
    "@vaultmind/validation",
    "@vaultmind/vault-core",
    "@vaultmind/expiry-core",
    "@vaultmind/contractscan-core",
    "@vaultmind/backup-core",
    "@vaultmind/search",
  ],
  // The shared packages are TypeScript shipped with explicit `.js` import
  // specifiers (NodeNext style). Tell webpack to resolve `.js` -> `.ts`/`.tsx`.
  webpack(config) {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

module.exports = nextConfig;
