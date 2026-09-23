/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals"
import { act, renderHook } from "@testing-library/react"

import type { MediaItem } from "@/services/mediaUpload"

const uploadFileFromPage = jest.fn<(file: File, uploadType: unknown) => Promise<MediaItem>>()

await jest.unstable_mockModule("@/services/mediaUpload", () => ({ uploadFileFromPage }))
await jest.unstable_mockModule("@/utils/useCmsTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: {}, ready: true }),
}))

const { useChartDataFile } = await import("@/blocks/Chart/useChartDataFile")

const UPLOAD_TARGET = { courseId: "course-1" }
const DATA_URL = "/uploads/data.csv"

// Longer than the hook's waits for editing to pause.
const PAST_THE_DEBOUNCE_MS = 1000

const chartSpec = (data?: unknown) =>
  JSON.stringify(data === undefined ? { mark: "bar" } : { mark: "bar", data })

/** Drives the hook the way the modal does, keeping the spec and the attached URL in test state. */
const renderDataFile = (initialSpec: string, initialDataFileUrl?: string) => {
  const state = { spec: initialSpec, dataFileUrl: initialDataFileUrl }
  const onFileAttached = jest.fn<() => void>()
  const rendered = renderHook(() =>
    useChartDataFile({
      spec: state.spec,
      dataFileUrl: state.dataFileUrl,
      uploadTarget: UPLOAD_TARGET,
      getCurrentSpec: () => state.spec,
      writeSpec: (next) => {
        state.spec = next
      },
      setDataFileUrl: (url) => {
        state.dataFileUrl = url
      },
      onFileAttached,
    }),
  )
  return {
    ...rendered,
    state,
    onFileAttached,
    /** Re-renders with whatever the writes above left behind, as an attribute update would. */
    sync: () => rendered.rerender(),
    parsedSpec: () => JSON.parse(state.spec),
  }
}

/** Lets pending promises settle inside act(), which awaiting the real work would also do. */
const flushPromises = () => Promise.resolve()

beforeEach(() => {
  jest.useFakeTimers()
  uploadFileFromPage.mockReset()
  uploadFileFromPage.mockResolvedValue({ url: "/uploads/chart-data.json" })
})

afterEach(() => {
  jest.useRealTimers()
})

describe("useChartDataFile", () => {
  describe("attaching a file", () => {
    it("points the spec at the chosen file and moves the teacher on", () => {
      const { result, state, onFileAttached, parsedSpec } = renderDataFile(chartSpec())

      act(() => result.current.selectFile({ url: DATA_URL }))

      expect(state.dataFileUrl).toBe(DATA_URL)
      expect(parsedSpec().data).toEqual({ url: DATA_URL, format: { type: "csv" } })
      expect(onFileAttached).toHaveBeenCalledTimes(1)
      expect(result.current.error).toBeUndefined()
    })

    it("starts a spec off for a block that has none yet", () => {
      const { result, parsedSpec } = renderDataFile("")

      act(() => result.current.selectFile({ url: DATA_URL }))

      expect(parsedSpec().$schema).toContain("vega-lite")
      expect(parsedSpec().data.url).toBe(DATA_URL)
    })

    it("leaves the file unattached when the spec is too broken to point at it", () => {
      const { result, state, onFileAttached } = renderDataFile("{ not json")

      act(() => result.current.selectFile({ url: DATA_URL }))

      expect(state.dataFileUrl).toBeUndefined()
      expect(state.spec).toBe("{ not json")
      expect(onFileAttached).not.toHaveBeenCalled()
      expect(result.current.error).toBe("chart-data-file-ok-but-spec-invalid")
    })

    it("reports a failure from the media picker itself", () => {
      const { result } = renderDataFile(chartSpec())

      act(() => result.current.reportUploadError(new Error("file too large")))

      expect(result.current.error).toBe("file too large")
    })
  })

  describe("removing a file", () => {
    it("detaches the file and takes the data out of the spec", () => {
      const { result, state, parsedSpec } = renderDataFile(chartSpec({ url: DATA_URL }), DATA_URL)

      act(() => result.current.removeFile())

      expect(state.dataFileUrl).toBeUndefined()
      expect("data" in parsedSpec()).toBe(false)
      expect(parsedSpec().mark).toBe("bar")
    })

    it("still detaches the file when the spec cannot be rewritten", () => {
      const { result, state } = renderDataFile("{ not json", DATA_URL)

      act(() => result.current.removeFile())

      expect(state.dataFileUrl).toBeUndefined()
      expect(state.spec).toBe("{ not json")
    })

    it("drops a pending extraction, which would write a file back into the cleared spec", async () => {
      const inlineSpec = chartSpec({ values: [{ a: 1 }] })
      const { result } = renderDataFile(inlineSpec, DATA_URL)

      act(() => result.current.scheduleExtraction(inlineSpec))
      act(() => result.current.removeFile())
      await act(async () => {
        jest.advanceTimersByTime(PAST_THE_DEBOUNCE_MS)
        await flushPromises()
      })

      expect(uploadFileFromPage).not.toHaveBeenCalled()
    })
  })

  describe("restoring a file an edit dropped", () => {
    it("offers the file back once editing pauses, not while it is being retyped", () => {
      const { result, sync } = renderDataFile(chartSpec(), DATA_URL)

      expect(result.current.isDetached).toBe(false)
      act(() => {
        jest.advanceTimersByTime(PAST_THE_DEBOUNCE_MS)
      })
      sync()
      expect(result.current.isDetached).toBe(true)
    })

    it("puts the data back and confirms it, then withdraws the offer", () => {
      const { result, sync, parsedSpec } = renderDataFile(chartSpec(), DATA_URL)
      act(() => {
        jest.advanceTimersByTime(PAST_THE_DEBOUNCE_MS)
      })
      sync()

      act(() => result.current.reinsertFile())
      sync()

      expect(parsedSpec().data).toEqual({ url: DATA_URL, format: { type: "csv" } })
      expect(result.current.restoreConfirmed).toBe(true)
      expect(result.current.isDetached).toBe(false)
    })

    it("stops confirming the restore after a while, so the notice does not linger", () => {
      const { result, sync } = renderDataFile(chartSpec(), DATA_URL)
      act(() => {
        jest.advanceTimersByTime(PAST_THE_DEBOUNCE_MS)
      })
      sync()
      act(() => result.current.reinsertFile())
      sync()
      expect(result.current.restoreConfirmed).toBe(true)

      act(() => {
        jest.advanceTimersByTime(10_000)
      })

      expect(result.current.restoreConfirmed).toBe(false)
    })

    it("does nothing when there is no file to put back", () => {
      const { result, state } = renderDataFile(chartSpec())

      act(() => result.current.reinsertFile())

      expect(state.spec).toBe(chartSpec())
      expect(result.current.restoreConfirmed).toBe(false)
    })

    it("never offers a restore for a block with no file attached", () => {
      const { result, sync } = renderDataFile(chartSpec())

      act(() => {
        jest.advanceTimersByTime(PAST_THE_DEBOUNCE_MS)
      })
      sync()

      expect(result.current.isDetached).toBe(false)
    })
  })

  describe("lifting inline data into a file", () => {
    it("uploads the data and points the spec and the block at the new file", async () => {
      const inlineSpec = chartSpec({ values: [{ category: "A", value: 1 }] })
      const { result, state, parsedSpec } = renderDataFile(inlineSpec)

      act(() => result.current.scheduleExtraction(inlineSpec))
      await act(async () => {
        jest.advanceTimersByTime(PAST_THE_DEBOUNCE_MS)
        await flushPromises()
      })

      expect(uploadFileFromPage).toHaveBeenCalledTimes(1)
      expect(state.dataFileUrl).toBe("/uploads/chart-data.json")
      expect(parsedSpec().data).toEqual({
        url: "/uploads/chart-data.json",
        format: { type: "json" },
      })
      expect(result.current.extractedDataUrl).toBe("/uploads/chart-data.json")
    })

    it("forgets the extracted file once another one is chosen", async () => {
      const inlineSpec = chartSpec({ values: [{ a: 1 }] })
      const { result } = renderDataFile(inlineSpec)
      act(() => result.current.scheduleExtraction(inlineSpec))
      await act(async () => {
        jest.advanceTimersByTime(PAST_THE_DEBOUNCE_MS)
        await flushPromises()
      })
      expect(result.current.extractedDataUrl).toBeDefined()

      act(() => result.current.selectFile({ url: DATA_URL }))

      expect(result.current.extractedDataUrl).toBeUndefined()
    })
  })
})
