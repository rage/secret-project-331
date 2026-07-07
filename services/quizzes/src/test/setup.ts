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

// The parent connection uses MessageChannel, which jsdom lacks. Tests only need inert ports.
class StubMessageChannel {
  port1 = { postMessage: () => {} }
  port2 = { postMessage: () => {} }
}
;(globalThis as unknown as { MessageChannel: unknown }).MessageChannel = StubMessageChannel

// Component tests call useTranslation; return the key so assertions don't depend on loaded
// resources. Spread the real module so other exports (e.g. initReactI18next) keep working.
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
