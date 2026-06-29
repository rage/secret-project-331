import { jest } from "@jest/globals"

// Make the `jest` mock API available as a global (it is not auto-injected under ESM).
global.jest = jest
