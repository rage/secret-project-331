const nextJest = require("next/jest")

const createJestConfig = nextJest({
  dir: "../../../services/main-frontend",
})

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
  },
}

module.exports = createJestConfig(customJestConfig)
