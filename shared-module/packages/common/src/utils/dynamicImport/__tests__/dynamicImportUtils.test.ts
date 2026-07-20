import {
  importWithRetry,
  isChunkLoadError,
  isProbablyReactComponent,
  withTimeout,
} from "../dynamicImportUtils"

describe("isProbablyReactComponent", () => {
  test("accepts functions", () => {
    expect(isProbablyReactComponent(() => null)).toBe(true)
  })

  test("accepts objects with $$typeof", () => {
    const value = { $$typeof: Symbol.for("react.forward_ref") }
    expect(isProbablyReactComponent(value)).toBe(true)
  })

  test("rejects null", () => {
    expect(isProbablyReactComponent(null)).toBe(false)
  })

  test("rejects plain objects", () => {
    expect(isProbablyReactComponent({})).toBe(false)
  })

  test("rejects strings", () => {
    expect(isProbablyReactComponent("MyComp")).toBe(false)
  })
})

describe("isChunkLoadError", () => {
  test("detects webpack chunk errors", () => {
    const error = new Error("Loading chunk 42 failed")
    error.name = "ChunkLoadError"
    expect(isChunkLoadError(error)).toBe(true)
  })

  test("ignores regular errors", () => {
    expect(isChunkLoadError(new Error("network"))).toBe(false)
  })

  test("ignores non-errors", () => {
    expect(isChunkLoadError("oops")).toBe(false)
  })
})

describe("withTimeout", () => {
  test("resolves when wrapped promise resolves before timeout", async () => {
    await expect(withTimeout(Promise.resolve(42), 1_000, "timeout")).resolves.toBe(42)
  })

  test("rejects when deadline passes before promise resolves", async () => {
    jest.useFakeTimers()
    const slow = new Promise<never>(() => {
      // never resolves
    })

    const promise = withTimeout(slow, 100, "timed out")

    jest.advanceTimersByTime(101)

    await expect(promise).rejects.toThrow("timed out")

    jest.useRealTimers()
  })
})

describe("importWithRetry", () => {
  test("returns immediately on success", async () => {
    const fn = jest.fn().mockResolvedValue("ok")

    await expect(importWithRetry(fn, 3, 0)).resolves.toBe("ok")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test("retries and eventually succeeds", async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error("fail")).mockResolvedValue("ok")
    const onRetry = jest.fn()
    const sleep = jest.fn(async () => {})

    await expect(importWithRetry(fn, 3, 1_000, onRetry, sleep)).resolves.toBe("ok")

    expect(fn).toHaveBeenCalledTimes(2)
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error))
  })

  test("throws after exhausting attempts", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("always fails"))
    const sleep = jest.fn(async () => {})

    await expect(importWithRetry(fn, 3, 1_000, undefined, sleep)).rejects.toThrow("always fails")

    expect(fn).toHaveBeenCalledTimes(3)
  })

  test("uses exponential backoff", async () => {
    const sleep = jest.fn(async () => {})
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("first"))
      .mockRejectedValueOnce(new Error("second"))
      .mockResolvedValue("ok")

    await importWithRetry(fn, 3, 1_000, undefined, sleep)

    expect(sleep).toHaveBeenNthCalledWith(1, 1_000)
    expect(sleep).toHaveBeenNthCalledWith(2, 2_000)
  })
})
