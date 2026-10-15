import { defineConfig } from "tsdown"

// Build config for publishing @moocfi/create-exercise-service to npm as a `pnpm create` initializer.
// Unlike the library packages this is a Node CLI: a single bundled ESM entry with a shebang, exposed
// via the `bin` field. The template snapshot it scaffolds from is copied into dist/template by
// scripts/bundle-template.ts (run after this build via the package's `build` script).
export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  // A CLI ships no public types; skip dts (and attw, which would just report "no types").
  dts: false,
  sourcemap: true,
  // Make dist/index.mjs directly executable as the bin.
  banner: { js: "#!/usr/bin/env node" },
  publint: true,
})
