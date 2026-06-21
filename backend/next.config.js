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
};

module.exports = nextConfig;
