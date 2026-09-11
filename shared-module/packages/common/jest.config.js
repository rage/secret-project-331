// jest.config.js
const nextJest = require("next/jest")

const createJestConfig = nextJest({
  dir: "../../../services/main-frontend",
})

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/tests/setup-jest.js"],

  transformIgnorePatterns: ["node_modules/(?!(uuid|until-async|msw|@mswjs/interceptors)/)"],

  moduleNameMapper: {
    "^react$": require.resolve("react"),
    "^react-dom$": require.resolve("react-dom"),
    "^react-i18next$": require.resolve("react-i18next"),
  },

  testEnvironmentOptions: {
    customExportConditions: ["node"],
  },
}

module.exports = createJestConfig(customJestConfig)
