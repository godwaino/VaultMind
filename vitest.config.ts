import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "backend/**/*.test.ts"],
    environment: "node",
    // node:sqlite is a newer built-in; ensure Vite externalises it instead of
    // trying to bundle/transform it.
    server: {
      deps: {
        external: [/node:sqlite/],
      },
    },
    coverage: {
      provider: "v8",
      include: ["packages/**/src/**", "backend/lib/**"],
    },
  },
});
