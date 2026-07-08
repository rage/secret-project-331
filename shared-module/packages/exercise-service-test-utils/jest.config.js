// jest.config.js
const nextJest = require("next/jest")

const createJestConfig = nextJest()

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/tests/setup-jest.js"],
  // Only our own unit tests. Deliberately narrower than the broad `**/*.spec` pattern the other
  // packages use, so it never picks up a `@playwright/test` spec (which would fail under jest).
  testMatch: ["<rootDir>/tests/**/*.test.ts"],

  transformIgnorePatterns: ["node_modules/(?!(uuid|until-async|msw|@mswjs/interceptors)/)"],

  testEnvironmentOptions: {
    customExportConditions: ["node"],
  },

  moduleNameMapper: {
    // next/jest does not read tsconfig `paths`; map the cross-package alias to sibling source.
    "^@/shared-module/exercise-protocol/(.*)$": "<rootDir>/../exercise-protocol/src/$1",
  },
}

module.exports = createJestConfig(customJestConfig)
