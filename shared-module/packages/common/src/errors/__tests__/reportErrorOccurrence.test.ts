import { jest } from "@jest/globals"

import { flushPendingErrorOccurrences, reportErrorOccurrence } from "../reportErrorOccurrence"

const createDeferredResponse = () => {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((resolver) => {
    resolve = resolver
  })
  return { promise, resolve }
}

describe("reportErrorOccurrence", () => {
  const browserGlobal = window as Window & { fetch?: typeof fetch }
  const pendingErrorReportsStorageKey = "pending_error_occurrence_reports"
  const originalFetch = browserGlobal.fetch
  const originalSendBeacon = navigator.sendBeacon
  const originalNavigatorOnline = navigator.onLine

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

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: originalNavigatorOnline,
    })
  })

  const readPendingReports = () => {
    const raw = window.localStorage.getItem(pendingErrorReportsStorageKey)
    return raw ? (JSON.parse(raw) as { body: string }[]) : []
  }

  test("uses fetch for normal browser reports even when sendBeacon is available", async () => {
    const sendBeacon = jest.fn(() => true)
    const fetchMock = jest.fn(() => Promise.resolve({ ok: true } as Response))
    const payload = {
      service: "main-frontend",
      error_source: "frontend" as const,
      message: "Frontend crashed",
      path: "/dashboard",
      details: { severity: "high" },
    }

    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: sendBeacon,
      writable: true,
    })
    browserGlobal.fetch = fetchMock as typeof fetch

    await reportErrorOccurrence(payload)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sendBeacon).not.toHaveBeenCalled()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit | undefined]
    expect(url).toBe("/api/v0/errors")
    expect(init?.method).toBe("POST")
    expect(init?.keepalive).toBe(true)
    expect(init?.headers).toEqual({
      "content-type": "application/json",
    })
    expect(JSON.parse(String(init?.body))).toEqual(payload)
  })

  test("buffers failed reports and flushes them with sendBeacon on exit", async () => {
    const sendBeacon = jest.fn(() => true)
    const fetchMock = jest.fn(() => Promise.resolve({ ok: false, status: 503 } as Response))
    const payload = {
      service: "main-frontend",
      error_source: "frontend" as const,
      message: "Frontend crashed",
      path: "/dashboard",
      details: { severity: "high" },
    }

    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: sendBeacon,
      writable: true,
    })
    browserGlobal.fetch = fetchMock as typeof fetch

    await reportErrorOccurrence(payload)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sendBeacon).not.toHaveBeenCalled()

    await flushPendingErrorOccurrences({ transport: "exit" })

    expect(sendBeacon).toHaveBeenCalledTimes(1)
    const [url, blob] = sendBeacon.mock.calls[0] as unknown as [string, Blob]
    expect(url).toBe("/api/v0/errors")
    expect(blob.type).toBe("application/json")
    expect(blob.size).toBe(new Blob([JSON.stringify(payload)]).size)

    await flushPendingErrorOccurrences()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test("preserves reports enqueued while a flush is already in flight", async () => {
    const firstFlush = createDeferredResponse()
    const fetchMock = jest.fn(() => firstFlush.promise)
    const firstPayload = {
      service: "main-frontend",
      error_source: "frontend" as const,
      message: "Initial buffered crash",
      path: "/dashboard",
    }
    const secondPayload = {
      service: "main-frontend",
      error_source: "frontend" as const,
      message: "New crash during flush",
      path: "/settings",
    }

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    })
    browserGlobal.fetch = fetchMock as typeof fetch

    await reportErrorOccurrence(firstPayload)

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    })

    const flushPromise = flushPendingErrorOccurrences()

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    })

    await reportErrorOccurrence(secondPayload)

    firstFlush.resolve({ ok: true } as Response)
    await flushPromise

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(readPendingReports()).toHaveLength(1)
    expect(JSON.parse(readPendingReports()[0].body)).toEqual(secondPayload)
  })

  test("does not resend the same buffered report during overlapping flushes", async () => {
    const deferredResponse = createDeferredResponse()
    const fetchMock = jest.fn(() => deferredResponse.promise)
    const payload = {
      service: "main-frontend",
      error_source: "frontend" as const,
      message: "Frontend crashed",
      path: "/dashboard",
    }

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    })
    browserGlobal.fetch = fetchMock as typeof fetch

    await reportErrorOccurrence(payload)

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    })

    const firstFlush = flushPendingErrorOccurrences()
    const secondFlush = flushPendingErrorOccurrences()

    expect(fetchMock).toHaveBeenCalledTimes(1)

    deferredResponse.resolve({ ok: true } as Response)
    await Promise.all([firstFlush, secondFlush])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(readPendingReports()).toHaveLength(0)
  })

  test("buffers immediately while offline", async () => {
    const sendBeacon = jest.fn(() => true)
    const fetchMock = jest.fn(() => Promise.resolve({ ok: true } as Response))
    const payload = {
      service: "main-frontend",
      error_source: "frontend" as const,
      message: "Frontend crashed",
      path: "/dashboard",
    }

    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: sendBeacon,
      writable: true,
    })
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    })
    browserGlobal.fetch = fetchMock as typeof fetch

    await reportErrorOccurrence(payload)

    expect(fetchMock).not.toHaveBeenCalled()

    await flushPendingErrorOccurrences({ transport: "exit" })

    expect(sendBeacon).toHaveBeenCalledTimes(1)
  })
})
