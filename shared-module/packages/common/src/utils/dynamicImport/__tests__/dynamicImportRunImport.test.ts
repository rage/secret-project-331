import type { ComponentType } from "react"

import dynamicImport, { type DynamicImportDeps } from ".."
import { getDynamicImportStatus } from "../dynamicImportStore"

type Loader = () => Promise<{ default: ComponentType<unknown> }>

const makeDeps = (overrides: Partial<DynamicImportDeps> = {}): DynamicImportDeps => {
  let capturedLoader: Loader | null = null

  return {
    now: jest.fn(() => 1_000),
    reload: jest.fn(),
    getOnline: jest.fn(() => true),
    log: jest.fn(),
    logError: jest.fn(),
    sleep: jest.fn(async () => {}),
    idFactory: jest.fn(() => "dyn_test_1"),
    dynamicFn: jest.fn((loader: Loader) => {
      capturedLoader = loader
      return (() => null) as unknown as ComponentType<unknown>
    }),
    get _capturedLoader() {
      return capturedLoader
    },
    ...overrides,
  } as DynamicImportDeps & { _capturedLoader: Loader | null }
}

type DepsWithLoader = ReturnType<typeof makeDeps> & { _capturedLoader: Loader | null }

describe("dynamicImport runImport behavior (via loader)", () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  test("sets resolved_pending_commit with timestamps on successful import", async () => {
    const now = jest.fn().mockReturnValueOnce(1_000).mockReturnValueOnce(1_500)
    const deps = makeDeps({ now }) as DepsWithLoader
    const importFn = jest.fn().mockResolvedValue({
      default: (() => null) as ComponentType<unknown>,
    })

    dynamicImport(importFn, deps)

    const loader = deps._capturedLoader
    expect(loader).not.toBeNull()
    await loader?.()

    expect(importFn).toHaveBeenCalled()
    expect(getDynamicImportStatus("dyn_test_1")).toMatchObject({
      state: "import_resolved_pending_commit",
      startedAt: 1_000,
      resolvedAt: 1_500,
    })
  })

  test("marks import_rejected on failure and stores error message", async () => {
    const deps = makeDeps() as DepsWithLoader
    const importFn = jest.fn().mockRejectedValue(new Error("network"))

    dynamicImport(importFn, deps)

    const loader = deps._capturedLoader
    expect(loader).not.toBeNull()
    await loader?.()

    expect(importFn).toHaveBeenCalled()
    expect(getDynamicImportStatus("dyn_test_1")).toMatchObject({
      state: "import_rejected",
      errorMessage: "network",
    })
  })

  test("calls reload from deps when a ChunkLoadError is seen during retry", async () => {
    const reload = jest.fn()
    const log = jest.fn()
    const logError = jest.fn()
    const deps = makeDeps({ reload }) as DepsWithLoader
    const chunkError = new Error("Loading chunk failed")
    chunkError.name = "ChunkLoadError"

    const importFn = jest
      .fn()
      .mockRejectedValueOnce(chunkError)
      .mockResolvedValue({
        default: (() => null) as ComponentType<unknown>,
      })

    dynamicImport(importFn, { ...deps, log, logError })

    const loader = deps._capturedLoader
    expect(loader).not.toBeNull()
    await loader?.()

    expect(reload).toHaveBeenCalledTimes(1)
    expect(importFn).toHaveBeenCalledTimes(1)
    expect(getDynamicImportStatus("dyn_test_1")).toMatchObject({
      state: "loading",
    })
    expect(log).toHaveBeenCalledWith("dyn_test_1", "dynamic-import-chunk-load-reload-triggered")
    expect(logError).not.toHaveBeenCalledWith(
      "dyn_test_1",
      "dynamic-import-or-wrapping-failed",
      expect.anything(),
    )
  })

  test("allows a fresh import attempt after failure by resetting the cached promise", async () => {
    const deps = makeDeps() as DepsWithLoader
    const importFn = jest.fn().mockRejectedValue(new Error("always fails"))

    dynamicImport(importFn, deps)

    const loader = deps._capturedLoader
    expect(loader).not.toBeNull()

    await loader?.()
    const firstCallCount = importFn.mock.calls.length

    await loader?.()
    const secondCallCount = importFn.mock.calls.length

    expect(secondCallCount).toBeGreaterThan(firstCallCount)
  })

  test("uses injected loggers for resolved and no-commit timeout paths", async () => {
    jest.useFakeTimers()
    const log = jest.fn()
    const logError = jest.fn()
    const deps = makeDeps({ log, logError }) as DepsWithLoader
    const importFn = jest.fn().mockResolvedValue({
      default: (() => null) as ComponentType<unknown>,
    })

    dynamicImport(importFn, deps)

    const loader = deps._capturedLoader
    expect(loader).not.toBeNull()
    await loader?.()

    expect(log).toHaveBeenCalledWith("dyn_test_1", "dynamic-import-resolved-waiting-for-commit")

    await jest.advanceTimersByTimeAsync(5_000)

    expect(logError).toHaveBeenCalledWith(
      "dyn_test_1",
      "dynamic-import-resolved-but-no-commit-after-5s",
      expect.objectContaining({ state: "import_resolved_pending_commit" }),
    )
  })
})
