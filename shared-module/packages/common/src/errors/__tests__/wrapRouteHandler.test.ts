import { jest } from "@jest/globals"

import { wrapRouteHandler } from "../wrapRouteHandler"

describe("wrapRouteHandler", () => {
  const browserGlobal = window as Window & { fetch?: typeof fetch }
  const originalFetch = browserGlobal.fetch
  const originalSendBeacon = navigator.sendBeacon

  afterEach(() => {
    jest.restoreAllMocks()
    window.localStorage.clear()

    if (originalFetch) {
      browserGlobal.fetch = originalFetch
    } else {
      Reflect.deleteProperty(browserGlobal, "fetch")
    }

    if (originalSendBeacon) {
      Object.defineProperty(navigator, "sendBeacon", {
        configurable: true,
        value: originalSendBeacon,
        writable: true,
      })
    } else {
      Reflect.deleteProperty(navigator, "sendBeacon")
    }
  })

  test("reports wrapped route handler failures as backend errors", async () => {
    const fetchMock = jest.fn(() => Promise.resolve({ ok: true } as Response))
    const error = new Error("route exploded")
    const handler = wrapRouteHandler(
      // oxlint-disable-next-line require-await -- async so the handler rejects rather than throws synchronously
      async (_request: { method: string; url: string }) => {
        throw error
      },
      {
        service: "main-frontend",
        operation: "load-course",
      },
    )

    Reflect.deleteProperty(navigator, "sendBeacon")
    browserGlobal.fetch = fetchMock as typeof fetch

    await expect(
      handler({
        method: "POST",
        url: "https://example.com/api/course",
      }),
    ).rejects.toBe(error)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit | undefined]
    expect(url).toBe("/api/v0/errors")
    expect(init?.method).toBe("POST")
    expect(init?.headers).toEqual({
      "content-type": "application/json",
    })

    const body = JSON.parse(String(init?.body))
    expect(body).toEqual(
      expect.objectContaining({
        service: "main-frontend",
        error_source: "backend",
        message: "route exploded",
        path: "/api/course",
        details: {
          kind: "next-route-handler",
          method: "POST",
          operation: "load-course",
          url: "https://example.com/api/course",
        },
      }),
    )
    expect(body.stack_trace).toContain("route exploded")
  })
})
