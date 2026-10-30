const vm = require("vm")

const nextJest = require("next/jest")

// Providing the path to your Next.js app which will enable loading next.config.js and .env files
const createJestConfig = nextJest({ dir: "./" })

// next/jest's SWC transform picks ESM vs CJS output from extensionsToTreatAsEsm plus the presence of
// vm.Module, but caches both under the same key: a run without --experimental-vm-modules leaves CJS
// output behind that the next flagged run loads as ESM, failing with "exports is not defined" or
// "does not provide an export named X" in unrelated files. Fail loudly instead of poisoning the cache.
if (!("Module" in vm)) {
  throw new Error(
    'jest needs --experimental-vm-modules here: run `pnpm test`, or prefix NODE_OPTIONS="--experimental-vm-modules".',
  )
}

/** Tests that run the built validator worker bundle, which takes a while to build. */
const BUNDLE_TESTS = "/tests/blockValidator/(validateBlocks|blockSchemas)\\.test\\.ts$"

const sharedJestConfig = {
  testEnvironment: "jsdom",
  // A local production build copies package.json into .next/standalone.
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  moduleNameMapper: {
    // SWC rewrites static "@/" imports, but not runtime specifiers like jest.unstable_mockModule("@/...").
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // Tests use top-level await and jest.unstable_mockModule, and uuid ships ESM only. Adding a second
  // transformer (a ts-jest preset) or dropping this makes SWC emit CJS and named imports break.
  extensionsToTreatAsEsm: [".ts", ".tsx"],
}

// A project's global setup runs only when one of its tests does, so other runs skip the bundle build.
module.exports = async () => ({
  projects: await Promise.all([
    createJestConfig({
      ...sharedJestConfig,
      displayName: "cms",
      testPathIgnorePatterns: ["/node_modules/", "/src/shared-module/", BUNDLE_TESTS],
    })(),
    createJestConfig({
      ...sharedJestConfig,
      displayName: "block-validator-bundle",
      testRegex: BUNDLE_TESTS,
      globalSetup: "<rootDir>/tests/blockValidator/globalSetup.mjs",
      globalTeardown: "<rootDir>/tests/blockValidator/globalTeardown.mjs",
    })(),
  ]),
})
