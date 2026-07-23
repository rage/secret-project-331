import { defineConfig } from "tsdown"

// Build config for publishing @moocfi/exercise-service-test-utils to npm. See exercise-protocol/tsdown.config.ts
// for why this build is separate from the repo's internal (vendored) consumption.
//
// Sibling shared-module packages are imported in source via the internal alias
// `@/shared-module/exercise-<pkg>/...`. For the published build those must become bare
// `@moocfi/exercise-<pkg>/...` imports marked external, so the package depends on its siblings via
// npm instead of inlining their source. The plugin below rewrites and externalizes them for both
// the JS and the .d.ts passes; types still resolve during the build through the tsconfig `paths`
// alias to the sibling's local `src/`.
const externalizeSharedModuleSiblings = {
  name: "externalize-shared-module-siblings",
  resolveId(source: string) {
    const match = /^@\/shared-module\/(exercise-[a-z-]+)(\/.*)?$/.exec(source)
    if (match) {
      return { id: `@moocfi/${match[1]}${match[2] ?? ""}`, external: true }
    }
    return null
  },
}

export default defineConfig({
  entry: ["src/**/*.{ts,tsx}"],
  format: "esm",
  unbundle: true,
  dts: true,
  sourcemap: true,
  plugins: [externalizeSharedModuleSiblings],
  // hostEmulator.js is a dependency-free arrow-function string meant to be cat/eval-injected into a
  // browser (kept byte-identical to HOST_EMULATOR_SOURCE, guarded by sourceParity.test.ts). It is
  // not imported by any TS module, so it falls outside the entry glob — copy it verbatim so npm
  // consumers can read node_modules/@moocfi/exercise-service-test-utils/dist/browser/hostEmulator.js.
  copy: [{ from: "src/browser/hostEmulator.js", to: "dist/browser" }],
  publint: true,
  attw: { profile: "esm-only" },
})
