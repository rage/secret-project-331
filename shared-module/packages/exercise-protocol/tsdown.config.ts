import { defineConfig } from "tsdown"

// Build config for publishing @moocfi/exercise-protocol to npm. The repo's own services do NOT use
// this build: they vendor src/ via sync.ts and resolve it through tsconfig path aliases, which
// ignore package.json main/exports. This build exists solely for external npm consumers.
//
// unbundle mode emits one .mjs + .d.mts per source file preserving the src/ tree (the packages ship
// ESM only, via the .mjs extension, so no "type": "module" is needed and the repo's CommonJS jest
// configs keep working). The wildcard "./*" exports map lets external consumers import the same deep
// paths the internal code uses (e.g. @moocfi/exercise-protocol/core/exercise-service-protocol-types).
export default defineConfig({
  entry: ["src/**/*.{ts,tsx}"],
  format: "esm",
  unbundle: true,
  dts: true,
  sourcemap: true,
  publint: true,
  // esm-only profile: don't flag "CJS resolves to ESM" — these packages are intentionally ESM-only.
  attw: { profile: "esm-only" },
})
