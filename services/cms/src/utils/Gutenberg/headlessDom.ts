import { JSDOM, VirtualConsole } from "jsdom"

// Must be imported before any @wordpress module: several read `window` while their modules load.

// jsdom can't parse the CSS-in-JS Gutenberg injects; those errors are noise here.
const virtualConsole = new VirtualConsole().forwardTo(console, { jsdomErrors: "none" })
const { window } = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
  virtualConsole,
})

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
})

const globals = globalThis as Record<string, unknown>
const windowProperties = window as unknown as Record<string, unknown>
for (const key of Object.getOwnPropertyNames(window)) {
  if (!(key in globalThis)) {
    try {
      globals[key] = windowProperties[key]
    } catch {
      // A few jsdom getters throw outside a browsing context; nothing here reads them.
    }
  }
}
globals.window = window
globals.document = window.document
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true })
globals.CSS = { supports: () => false, escape: (value: string) => value }
