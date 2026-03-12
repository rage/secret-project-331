/** @jest-environment jsdom */

import { jest } from "@jest/globals"

import dynamicWithIframeReload, {
  requestIframeReloadFromParent,
} from "../../src/utils/dynamicWithIframeReload"

describe("dynamicWithIframeReload", () => {
  afterEach(() => {
    const anyWindow = window as typeof window & {
      __exerciseServiceRequestReload?: () => void
    }
    delete anyWindow.__exerciseServiceRequestReload
    jest.useRealTimers()
  })

  test("requestIframeReloadFromParent calls the global bridge when present", async () => {
    let reloadCalls = 0
    const anyWindow = window as typeof window & {
      __exerciseServiceRequestReload?: () => void
    }
    anyWindow.__exerciseServiceRequestReload = () => {
      reloadCalls += 1
    }

    await requestIframeReloadFromParent()

    expect(reloadCalls).toBe(1)
  })

  test("requestIframeReloadFromParent waits for the global bridge to appear", async () => {
    jest.useFakeTimers()

    let reloadCalls = 0
    const anyWindow = window as typeof window & {
      __exerciseServiceRequestReload?: () => void
    }

    const reloadRequest = requestIframeReloadFromParent()

    window.setTimeout(() => {
      anyWindow.__exerciseServiceRequestReload = () => {
        reloadCalls += 1
      }
    }, 1_500)

    await jest.advanceTimersByTimeAsync(1_500)
    await reloadRequest

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

  test("requestIframeReloadFromParent gives up after 10 seconds if the bridge never appears", async () => {
    jest.useFakeTimers()

    const originalWarn = console.warn
    const warnCalls: unknown[][] = []
    console.warn = (...args: unknown[]) => {
      warnCalls.push(args)
    }

    try {
      const reloadRequest = requestIframeReloadFromParent()
      await jest.advanceTimersByTimeAsync(10_000)
      await reloadRequest

      expect(warnCalls).toEqual([
        [
          "[dynamicWithIframeReload] window.__exerciseServiceRequestReload() was not available within 10000ms",
        ],
      ])
    } finally {
      console.warn = originalWarn
    }
  })
})
