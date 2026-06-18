// jest.config.js
// next/jest is the monorepo's standard transform (SWC-based, auto-maps tsconfig `paths`). It is a
// dev-only dependency here; exercise-client's only runtime dependency is immer.
const nextJest = require("next/jest")

const createJestConfig = nextJest()

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/tests/setup-jest.js"],
  testMatch: ["**/?(*.)+(test|spec).(ts|tsx|js|jsx)"],

  transformIgnorePatterns: ["node_modules/(?!(uuid|until-async|msw|@mswjs/interceptors)/)"],

  testEnvironmentOptions: {
    customExportConditions: ["node"],
  },

  // next/jest does not read tsconfig `paths`; map the cross-package alias to the sibling source.
  moduleNameMapper: {
    "^@/shared-module/exercise-protocol/(.*)$": "<rootDir>/../exercise-protocol/src/$1",
  },
}

module.exports = createJestConfig(customJestConfig)
