import type { Mock as ViMock, MockInstance } from "vitest"

// Compatibility layer so the tests can keep using the `jest.*` names under Vitest:
//   - value `jest` is assigned in tests/setup.ts (`globalThis.jest = vi`)
//   - the `jest` namespace supplies the type-position aliases the tests still reference
// Mirrors how @types/jest merged a `var jest` value with a `namespace jest` of types.
declare global {
  // oxlint-disable-next-line no-redeclare -- this file is the declaration; `jest` is also a configured test global
  var jest: (typeof import("vitest"))["vi"]

  namespace jest {
    type SpyInstance = MockInstance
    type Mock = ViMock
  }
}
