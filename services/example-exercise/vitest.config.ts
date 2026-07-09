import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"
import svgr from "vite-plugin-svgr"
import { defineConfig } from "vitest/config"

export default defineConfig({
  // Resolve `@/*` -> `./src/*`. An explicit alias, not tsconfig paths: src/shared-module is
  // excluded from tsconfig but the vendored code imports via `@/`.
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  plugins: [
    // Match the build's SVG handling (default export) so tests render real icon components.
    svgr({
      include: "**/*.svg",
      svgrOptions: { exportType: "default", svgProps: { role: "presentation" } },
    }),
    react(),
  ],
  test: {
    // jsdom for component render tests; the API-handler tests use global Web Request/Response,
    // which works under either environment.
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
})
