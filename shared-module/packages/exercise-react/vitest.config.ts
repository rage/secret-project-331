import { fileURLToPath } from "node:url"

import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// Vitest does not read tsconfig `paths`, so mirror the cross-package aliases the old jest
// moduleNameMapper set up: resolve the sibling packages and `@/*` to source. plugin-react
// compiles JSX with the automatic React runtime (matching the old emotion->react jsx-runtime map).
const srcDir = (pkg: string) => fileURLToPath(new URL(`../${pkg}/src`, import.meta.url))
const ownSrc = fileURLToPath(new URL("./src", import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@\/shared-module\/exercise-protocol\/(.*)$/,
        replacement: `${srcDir("exercise-protocol")}/$1`,
      },
      {
        find: /^@\/shared-module\/exercise-client\/(.*)$/,
        replacement: `${srcDir("exercise-client")}/$1`,
      },
      { find: /^@\/(.*)$/, replacement: `${ownSrc}/$1` },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.js"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
  },
})
