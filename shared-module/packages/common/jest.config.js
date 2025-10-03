const nextJest = require("next/jest")

// Providing the path to your Next.js app which will enable loading next.config.js and .env files
const createJestConfig = nextJest()

// Any custom config you want to pass to Jest
const customJestConfig = {
  testEnvironment: "jsdom",
  testEnvironmentOptions: {
    customExportConditions: [""],
  },
  setupFilesAfterEnv: ["<rootDir>/tests/setup-jest.js"],
  testPathIgnorePatterns: ["/node_modules/", "/src/shared-module/"],
  // Handle ES modules compatibility in pnpm environment
  moduleNameMapper: {
    "^until-async$": "<rootDir>/tests/mocks/until-async.js",
  },
  transform: {},
  extensionsToTreatAsEsm: [".ts", ".tsx"],
}

// createJestConfig is exported in this way to ensure that next/jest can load the Next.js configuration, which is async
module.exports = createJestConfig(customJestConfig)
