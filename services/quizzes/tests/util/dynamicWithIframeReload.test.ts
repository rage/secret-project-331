/** @vitest-environment jsdom */

import { vi } from "vitest"

import dynamicWithIframeReload, {
  requestIframeReloadFromParent,
} from "../../src/utils/dynamicWithIframeReload"

const noop = () => {}
const dynamicFn = (loaderArg: unknown) => loaderArg

describe("dynamicWithIframeReload", () => {
  let realConsole: Pick<typeof console, "info" | "error" | "warn">

  beforeEach(() => {
    realConsole = {
      info: console.info,
      error: console.error,
      warn: console.warn,
    }
    console.info = noop
    console.error = noop
    console.warn = noop
  })

  afterEach(() => {
    console.info = realConsole.info
    console.error = realConsole.error
    console.warn = realConsole.warn
    const anyWindow = window as typeof window & {
      __exerciseServiceRequestReload?: () => void
    }
    delete anyWindow.__exerciseServiceRequestReload
    vi.useRealTimers()
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
    vi.useFakeTimers()

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

    await vi.advanceTimersByTimeAsync(1_500)
    await reloadRequest
    expect(reloadCalls).toBe(1)
  })

  test("succeeds on first loader attempt without requesting reload", async () => {
    const anyWindow = window as typeof window & {
      __exerciseServiceRequestReload?: () => void
    }
    anyWindow.__exerciseServiceRequestReload = vi.fn()

    const loader = vi.fn<() => Promise<{ default: () => null }>>().mockResolvedValue({
      default: () => null,
    })
    const wrappedLoader = dynamicWithIframeReload(
      loader as unknown as () => Promise<{ default: () => null }>,
      undefined,
      {
        dynamicFn: dynamicFn as typeof import("@/lib/next-shims/dynamic").default,
      },
    ) as unknown as () => Promise<unknown>

    await expect(wrappedLoader()).resolves.toEqual({ default: expect.any(Function) })
    expect(loader).toHaveBeenCalledTimes(1)
    expect(anyWindow.__exerciseServiceRequestReload).not.toHaveBeenCalled()
  })

  test("retries loader once after failure and then succeeds without requesting reload", async () => {
    vi.useFakeTimers()

    const anyWindow = window as typeof window & {
      __exerciseServiceRequestReload?: () => void
    }
    anyWindow.__exerciseServiceRequestReload = vi.fn()

    const loader = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error("dynamic load failed 1"))
      .mockResolvedValueOnce({ default: () => null })
    const wrappedLoaderPromise = (
      dynamicWithIframeReload(
        loader as unknown as () => Promise<{ default: () => null }>,
        undefined,
        {
          dynamicFn: dynamicFn as typeof import("@/lib/next-shims/dynamic").default,
        },
      ) as unknown as () => Promise<unknown>
    )()

    expect(loader).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(200)
    await expect(wrappedLoaderPromise).resolves.toEqual({ default: expect.any(Function) })
    expect(loader).toHaveBeenCalledTimes(2)
    expect(anyWindow.__exerciseServiceRequestReload).not.toHaveBeenCalled()
  })

  test("retries loader multiple times before succeeding without requesting reload", async () => {
    vi.useFakeTimers()

    const anyWindow = window as typeof window & {
      __exerciseServiceRequestReload?: () => void
    }
    anyWindow.__exerciseServiceRequestReload = vi.fn()

    const loader = vi
      .fn<() => Promise<{ default: () => null }>>()
      .mockRejectedValueOnce(new Error("dynamic load failed 1"))
      .mockRejectedValueOnce(new Error("dynamic load failed 2"))
      .mockResolvedValueOnce({ default: () => null })
    const wrappedLoaderPromise = (
      dynamicWithIframeReload(
        loader as unknown as () => Promise<{ default: () => null }>,
        undefined,
        {
          dynamicFn: dynamicFn as typeof import("@/lib/next-shims/dynamic").default,
        },
      ) as unknown as () => Promise<unknown>
    )()

    expect(loader).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(200)
    expect(loader).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(400)
    await expect(wrappedLoaderPromise).resolves.toEqual({ default: expect.any(Function) })
    expect(loader).toHaveBeenCalledTimes(3)
    expect(anyWindow.__exerciseServiceRequestReload).not.toHaveBeenCalled()
  })

  test("rethrows loader errors after all retries and requests iframe reload", async () => {
    let reloadCalls = 0
    const anyWindow = window as typeof window & {
      __exerciseServiceRequestReload?: () => void
    }
    anyWindow.__exerciseServiceRequestReload = () => {
      reloadCalls += 1
    }
    const wrappedLoader = dynamicWithIframeReload(
      // oxlint-disable-next-line require-await -- throwing loader must reject as a Promise; passed where () => Promise is expected
      async () => {
        throw new Error("dynamic load failed")
      },
      undefined,
      {
        dynamicFn: dynamicFn as typeof import("@/lib/next-shims/dynamic").default,
      },
    ) as unknown as () => Promise<unknown>

    expect(reloadCalls).toBe(0)
    await expect(wrappedLoader()).rejects.toThrow("dynamic load failed")
    expect(reloadCalls).toBe(1)
  })

  test("preserves the original loader error if the reload bridge throws after all retries", async () => {
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
    const wrappedLoader = dynamicWithIframeReload(
      // oxlint-disable-next-line require-await -- throwing loader must reject as a Promise; passed where () => Promise is expected
      async () => {
        throw new Error("dynamic load failed")
      },
      undefined,
      {
        dynamicFn: dynamicFn as typeof import("@/lib/next-shims/dynamic").default,
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
    vi.useFakeTimers()

    const originalWarn = console.warn
    const warnCalls: unknown[][] = []
    console.warn = (...args: unknown[]) => {
      warnCalls.push(args)
    }

    try {
      const reloadRequest = requestIframeReloadFromParent()
      await vi.advanceTimersByTimeAsync(10_000)
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
