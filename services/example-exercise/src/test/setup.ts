import "@testing-library/jest-dom/vitest"

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
