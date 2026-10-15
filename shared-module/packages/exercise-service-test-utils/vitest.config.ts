import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

// Vitest does not read tsconfig `paths`, so mirror the cross-package alias the old jest
// moduleNameMapper set up: resolve `@/shared-module/exercise-protocol/*` and `@/*` to source.
const protocolSrc = fileURLToPath(new URL("../exercise-protocol/src", import.meta.url))
const ownSrc = fileURLToPath(new URL("./src", import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@\/shared-module\/exercise-protocol\/(.*)$/,
        replacement: `${protocolSrc}/$1`,
      },
      { find: /^@\/(.*)$/, replacement: `${ownSrc}/$1` },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // Only our own unit tests; deliberately narrow so it never picks up a @playwright/test spec.
    include: ["tests/**/*.test.ts"],
  },
})
