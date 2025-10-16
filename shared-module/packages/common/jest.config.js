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

  extensionsToTreatAsEsm: [".ts", ".tsx"],
}

module.exports = createJestConfig(customJestConfig)
