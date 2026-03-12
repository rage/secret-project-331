/** @jest-environment jsdom */

import dynamicWithIframeReload, {
  requestIframeReloadFromParent,
} from "../../src/utils/dynamicWithIframeReload"

describe("dynamicWithIframeReload", () => {
  afterEach(() => {
    const anyWindow = window as typeof window & {
      __exerciseServiceRequestReload?: () => void
    }
    delete anyWindow.__exerciseServiceRequestReload
  })

  test("requestIframeReloadFromParent calls the global bridge when present", () => {
    let reloadCalls = 0
    const anyWindow = window as typeof window & {
      __exerciseServiceRequestReload?: () => void
    }
    anyWindow.__exerciseServiceRequestReload = () => {
      reloadCalls += 1
    }

    requestIframeReloadFromParent()

    expect(reloadCalls).toBe(1)
  })

  test("rethrows loader errors and requests iframe reload", async () => {
    let reloadCalls = 0
    const anyWindow = window as typeof window & {
      __exerciseServiceRequestReload?: () => void
    }
    anyWindow.__exerciseServiceRequestReload = () => {
      reloadCalls += 1
    }
    const dynamicFn = (loader: unknown) => loader
    const wrappedLoader = dynamicWithIframeReload(
      async () => {
        throw new Error("dynamic load failed")
      },
      undefined,
      {
        dynamicFn: dynamicFn as typeof import("next/dynamic").default,
      },
    ) as unknown as () => Promise<unknown>

    await expect(wrappedLoader()).rejects.toThrow("dynamic load failed")
    expect(reloadCalls).toBe(1)
  })

  test("preserves the original loader error if the reload bridge throws", async () => {
    const originalWarn = console.warn
    const warnCalls: unknown[][] = []
    console.warn = (...args: unknown[]) => {
      warnCalls.push(args)
    }
    const anyWindow = window as typeof window & {
      __exerciseServiceRequestReload?: () => void
    }
    anyWindow.__exerciseServiceRequestReload = () => {
      throw new Error("reload bridge failed")
    }
    const dynamicFn = (loader: unknown) => loader
    const wrappedLoader = dynamicWithIframeReload(
      async () => {
        throw new Error("dynamic load failed")
      },
      undefined,
      {
        dynamicFn: dynamicFn as typeof import("next/dynamic").default,
      },
    ) as unknown as () => Promise<unknown>

    try {
      await expect(wrappedLoader()).rejects.toThrow("dynamic load failed")
      expect(warnCalls).toEqual([
        [
          "[dynamicWithIframeReload] window.__exerciseServiceRequestReload() failed",
          expect.any(Error),
        ],
      ])
    } finally {
      console.warn = originalWarn
    }
  })
})
