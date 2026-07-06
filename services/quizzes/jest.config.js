const nextJest = require("next/jest")

// Providing the path to your Next.js app which will enable loading next.config.js and .env files
const createJestConfig = nextJest({ dir: "./" })

// Any custom config you want to pass to Jest
// Default is jsdom for component tests. API tests override with @jest-environment node
const customJestConfig = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/tests/setup-jest.js"],
  testPathIgnorePatterns: ["/node_modules/", "/src/shared-module/"],
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  moduleNameMapper: {
    // uuid v14 is ESM-only and next/jest does not let it through the transformer, so importing it
    // in a test crashes. Map it to a CommonJS stand-in with faithful validate/v4 implementations.
    "^uuid$": "<rootDir>/tests/__mocks__/uuid.js",
  },
}

// createJestConfig is exported in this way to ensure that next/jest can load the Next.js configuration, which is async
module.exports = createJestConfig(customJestConfig)
