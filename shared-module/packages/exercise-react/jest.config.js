// jest.config.js
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

  moduleNameMapper: {
    "^@emotion/react/jsx-runtime$": "react/jsx-runtime",
    "^@emotion/react/jsx-dev-runtime$": "react/jsx-dev-runtime",
    // next/jest does not read tsconfig `paths`; map the cross-package aliases to sibling source.
    "^@/shared-module/exercise-protocol/(.*)$": "<rootDir>/../exercise-protocol/src/$1",
    "^@/shared-module/exercise-client/(.*)$": "<rootDir>/../exercise-client/src/$1",
  },
}

module.exports = createJestConfig(customJestConfig)
