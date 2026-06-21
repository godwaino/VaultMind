/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages ship raw TypeScript (exports point at src/index.ts),
  // so Next must compile them as part of the app build.
  transpilePackages: [
    "@vaultmind/validation",
    "@vaultmind/consent",
    "@vaultmind/contractscan-core",
  ],
  // Source files use NodeNext-style ".js" specifiers that resolve to .ts files;
  // webpack needs the alias to follow them.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
