import "@testing-library/jest-dom/vitest"

import { vi } from "vitest"

// Tell React 19 we're in a test/act environment so state updates flush during render tests.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// jsdom does not implement ResizeObserver, which the iframe height tracker uses. Provide a no-op.
if (!("ResizeObserver" in globalThis)) {
  ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// The exercise-service parent connection uses MessageChannel. jsdom does not provide it, and tests
// only need inert ports (they never exchange real messages), matching the old Jest setup.
class StubMessageChannel {
  port1 = { postMessage: () => {} }
  port2 = { postMessage: () => {} }
}
;(globalThis as unknown as { MessageChannel: unknown }).MessageChannel = StubMessageChannel

// Component tests render UI that calls useTranslation; return the key so assertions are stable and
// don't depend on loaded translation resources (folds in the old tests/setup-jest.js stub). Only
// useTranslation/Translation are overridden — the real module is spread through so other exports
// (e.g. initReactI18next, used by initI18n) keep working.
vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { changeLanguage: () => Promise.resolve() },
    }),
    Translation: ({ children }: { children: (t: (key: string) => string) => unknown }) =>
      children((key: string) => key),
  }
})
