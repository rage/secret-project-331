import "@testing-library/jest-dom/vitest"

import { vi } from "vitest"

// React 19: flush state updates during render tests.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// jsdom lacks ResizeObserver (used by the iframe height tracker).
if (!("ResizeObserver" in globalThis)) {
  ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    public observe() {}
    public unobserve() {}
    public disconnect() {}
  }
}

// The parent connection uses MessageChannel, which jsdom lacks. Tests only need inert ports.
// oxlint-disable-next-line max-classes-per-file -- colocated test stub classes
class StubMessageChannel {
  public port1 = { postMessage: () => {} }
  public port2 = { postMessage: () => {} }
}
;(globalThis as unknown as { MessageChannel: unknown }).MessageChannel = StubMessageChannel

// Component tests call useTranslation; return the key so assertions don't depend on loaded
// resources. Spread the real module to keep other exports (e.g. initReactI18next) working.
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
