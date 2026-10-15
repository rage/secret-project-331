import { defineConfig } from "tsdown"

// Build config for publishing @moocfi/exercise-react to npm. See exercise-protocol/tsdown.config.ts
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
  // Build-only tsconfig: transforms JSX to the React automatic runtime (dev tsconfig keeps preserve).
  tsconfig: "tsconfig.build.json",
  format: "esm",
  unbundle: true,
  dts: true,
  sourcemap: true,
  plugins: [externalizeSharedModuleSiblings],
  publint: true,
  attw: { profile: "esm-only" },
})
