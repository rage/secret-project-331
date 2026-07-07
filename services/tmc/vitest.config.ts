import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"
import svgr from "vite-plugin-svgr"
import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  // Resolve `@/*` -> `./src/*`. An explicit alias (rather than reading tsconfig) is required because
  // src/shared-module is excluded from tsconfig, yet the vendored code imports via `@/`.
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  plugins: [
    // Match the build's SVG handling so tests render real icon components:
    // `import Icon from "./x.svg"` -> React component (default export).
    svgr({
      include: "**/*.svg",
      svgrOptions: { exportType: "default", svgProps: { role: "presentation" } },
    }),
    react(),
  ],
  test: {
    // Component render tests need a DOM; the API-handler tests use the global Web Request/Response
    // (available in Node in either environment), so jsdom as the default is fine for both.
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.{ts,tsx}"],
    // Never run the vendored shared-module's own tests (they target the source repo's Jest setup).
    exclude: [...configDefaults.exclude, "src/shared-module/**"],
  },
})
