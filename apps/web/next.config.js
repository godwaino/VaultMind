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
    // Proxy backend API calls server-side so the browser stays same-origin
    // (the backend has no CORS headers). Leave NEXT_PUBLIC_API_BASE_URL unset
    // so lib/env.ts falls back to same-origin and these rewrites take over.
    // BACKEND_URL can override the default in the Vercel project env.
    async rewrites() {
          const backend =
                  process.env.BACKEND_URL ??
                  "https://vault-mind-godwainos-projects.vercel.app";
          return ["auth", "contractscan", "account", "billing"].map((p) => ({
                  source: `/api/${p}/:path*`,
                  destination: `${backend}/api/${p}/:path*`,
          }));
    },
};

module.exports = nextConfig;
