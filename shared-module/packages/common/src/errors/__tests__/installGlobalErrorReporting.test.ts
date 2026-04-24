import { jest } from "@jest/globals"

import { getAuthLoggedInQueryKey } from "../../generated/auth-api/@tanstack/react-query.generated"
import { queryClient } from "../../services/appQueryClient"
import { installGlobalErrorReporting } from "../installGlobalErrorReporting"
import { reportErrorOccurrence } from "../reportErrorOccurrence"

describe("installGlobalErrorReporting", () => {
  const browserGlobal = window as Window & { fetch?: typeof fetch }
  const originalFetch = browserGlobal.fetch
  const originalSendBeacon = navigator.sendBeacon

  beforeEach(() => {
    queryClient.setQueryData(getAuthLoggedInQueryKey(), false)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    window.localStorage.clear()
    queryClient.clear()

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

  test("flushes buffered reports on pagehide using sendBeacon", async () => {
    const sendBeacon = jest.fn(() => true)
    const fetchMock = jest.fn(() => Promise.resolve({ ok: false, status: 503 } as Response))

    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: sendBeacon,
      writable: true,
    })
    browserGlobal.fetch = fetchMock as typeof fetch

    await reportErrorOccurrence({
      service: "main-frontend",
      error_source: "frontend",
      message: "Frontend crashed",
      path: "/dashboard",
    })

    installGlobalErrorReporting({ service: "main-frontend" })
    window.dispatchEvent(new Event("pagehide"))

    expect(sendBeacon).toHaveBeenCalledTimes(1)
  })
})
