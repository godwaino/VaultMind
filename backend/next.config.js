/**
 * Next.js config for the VaultMind API (App Router route handlers in app/api/*).
 * Deploys to Vercel as its own project (root directory = `backend`).
 * `transpilePackages` compiles the shared workspace packages (shipped as .ts).
 *
 * NOTE: `next`/`react` are installed on a dev machine (see DEPLOY.md) — they are
 * intentionally not added to the committed lockfile here so the test/typecheck
 * sandbox stays lean. The route handlers use the web-standard Request/Response API
 * and import nothing from "next", so typecheck + tests don't need Next installed.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: [
    "@vaultmind/validation",
    "@vaultmind/consent",
    "@vaultmind/contractscan-core",
  ],
  webpack: (config) => {
    // Route handlers and lib/* use NodeNext-style import specifiers with explicit
    // ".js" extensions that point at ".ts" sources. tsconfig uses moduleResolution
    // "Bundler", under which Next.js does not auto-alias .js -> .ts, so webpack
    // looks for a literal ".js" file and fails ("Module not found: .../foo.js").
    // Teach it to resolve the TypeScript sources behind those specifiers.
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    };
    return config;
  },
};

export default nextConfig;
