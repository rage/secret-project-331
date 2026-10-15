import { fileURLToPath } from "node:url"

import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// Vitest does not read tsconfig `paths`, so mirror the cross-package alias the old jest
// moduleNameMapper set up. plugin-react compiles JSX with the automatic React runtime (matching
// the old emotion->react jsx-runtime map).
const protocolSrc = fileURLToPath(new URL("../exercise-protocol/src", import.meta.url))
const ownSrc = fileURLToPath(new URL("./src", import.meta.url))

export default defineConfig({
  plugins: [react()],
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
    setupFiles: ["./tests/setup.js"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
  },
})
