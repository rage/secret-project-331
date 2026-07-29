import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

// Vitest does not read tsconfig `paths`, so mirror the cross-package aliases the old jest
// moduleNameMapper set up: resolve `@/shared-module/exercise-protocol/*` and `@/*` to source.
const srcDir = (pkg: string) => fileURLToPath(new URL(`../${pkg}/src`, import.meta.url))
const ownSrc = fileURLToPath(new URL("./src", import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@\/shared-module\/exercise-protocol\/(.*)$/,
        replacement: `${srcDir("exercise-protocol")}/$1`,
      },
      { find: /^@\/(.*)$/, replacement: `${ownSrc}/$1` },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
  },
})
