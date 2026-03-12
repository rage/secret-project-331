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
})
