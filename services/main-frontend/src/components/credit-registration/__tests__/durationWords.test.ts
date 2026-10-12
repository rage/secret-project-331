import type { CreditRegistrationTFunction } from "../constants"
import { formatFutureInWords, formatIntervalInWords } from "../durationWords"

const t = ((key: string, params?: Record<string, unknown>) =>
  `${key.replace("credit-registration-duration-", "")} ${String(params?.count ?? "")}`.trim()) as unknown as CreditRegistrationTFunction

const NOW = Date.parse("2026-09-01T10:00:00Z")

describe("formatIntervalInWords", () => {
  it("reads just under a minute as a minute, not 60 seconds", () => {
    expect(formatIntervalInWords(t, 59.6)).toBe("minutes 1")
  })

  it("keeps seconds below the rounding boundary", () => {
    expect(formatIntervalInWords(t, 59.4)).toBe("seconds 59")
  })
})

describe("formatFutureInWords", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(NOW)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const inMs = (ms: number) => formatFutureInWords(new Date(NOW + ms), "en")

  it("reads just under an hour as in 1 hour, not in 60 minutes", () => {
    expect(inMs(59.6 * 60_000)).toBe("in 1 hour")
  })

  it("reads just under a day as tomorrow, not in 24 hours", () => {
    expect(inMs(23.6 * 3_600_000)).toBe("tomorrow")
  })

  it("keeps minutes and hours below their boundaries", () => {
    expect(inMs(59.4 * 60_000)).toBe("in 59 minutes")
    expect(inMs(23.4 * 3_600_000)).toBe("in 23 hours")
  })
})
