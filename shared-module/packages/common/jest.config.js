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

  testEnvironmentOptions: {
    customExportConditions: ["node"],
  },

  // "@/shared-module/components/*" resolves through the main-frontend-synced copy, whose own
  // node_modules holds separate react/react-dom/react-i18next/i18next installs from common's.
  // Without pinning these, two React copies load and hooks crash with a null dispatcher, and a
  // second react-i18next context makes translations fall back to raw keys.
  moduleNameMapper: {
    "^react$": require.resolve("react"),
    "^react-dom$": require.resolve("react-dom"),
    "^react/jsx-runtime$": require.resolve("react/jsx-runtime"),
    "^react/jsx-dev-runtime$": require.resolve("react/jsx-dev-runtime"),
    "^react-i18next$": require.resolve("react-i18next"),
    "^i18next$": require.resolve("i18next"),
  },
}

module.exports = createJestConfig(customJestConfig)
