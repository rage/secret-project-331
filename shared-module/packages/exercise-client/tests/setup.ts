import { vi } from "vitest"

// The tests call the mock API as a bare global `jest.*` (many call sites). Vitest's `vi` is
// API-compatible (fn/spyOn/useFakeTimers/advanceTimersByTime/clearAllMocks/...), so expose it
// under the same name rather than rewriting every call. Types come from tests/jestCompat.d.ts.
globalThis.jest = vi
