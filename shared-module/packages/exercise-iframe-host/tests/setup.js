import { vi } from "vitest"
import "@testing-library/jest-dom/vitest"

// The tests call the mock API as a bare global `jest.*`. Vitest's `vi` is API-compatible, so
// expose it under the same name rather than rewriting every call. Types: tests/jestCompat.d.ts.
globalThis.jest = vi
