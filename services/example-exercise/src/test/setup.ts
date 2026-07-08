import "@testing-library/jest-dom/vitest"

// React 19: flush state updates during render tests.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// jsdom lacks ResizeObserver (used by the iframe height tracker).
if (!("ResizeObserver" in globalThis)) {
  ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
