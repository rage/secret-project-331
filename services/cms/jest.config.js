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

// Any custom config you want to pass to Jest
const customJestConfig = {
  testEnvironment: "jsdom",
  testPathIgnorePatterns: ["/node_modules/", "/src/shared-module/"],
  moduleNameMapper: {
    // SWC rewrites static "@/" imports, but not runtime specifiers like jest.unstable_mockModule("@/...").
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // Tests use top-level await and jest.unstable_mockModule, and uuid ships ESM only. Adding a second
  // transformer (a ts-jest preset) or dropping this makes SWC emit CJS and named imports break.
  extensionsToTreatAsEsm: [".ts", ".tsx"],
}

// createJestConfig is exported in this way to ensure that next/jest can load the Next.js configuration, which is async
module.exports = createJestConfig(customJestConfig)
