/**
 * @jest-environment jsdom
 */

import { jest } from "@jest/globals"
import { act, renderHook, waitFor } from "@testing-library/react"

import type { MediaItem } from "@/services/mediaUpload"

const uploadFileFromPage = jest.fn<(file: File, uploadType: unknown) => Promise<MediaItem>>()

await jest.unstable_mockModule("@/services/mediaUpload", () => ({ uploadFileFromPage }))

const { useInlineDataExtraction } = await import("@/blocks/Chart/useInlineDataExtraction")

// Longer than the hook's own wait for editing to pause.
const PAST_THE_DEBOUNCE_MS = 1000

const UPLOAD_TARGET = { courseId: "course-1" }

const specWithInlineData = JSON.stringify({
  mark: "bar",
  data: { values: [{ category: "A", value: 1 }] },
})

interface Callbacks {
  getCurrentSpec: () => string
  onDataExtracted: jest.Mock<(spec: string, dataFileUrl: string) => void>
  onError: jest.Mock<(message: string | undefined) => void>
}

const callbacks = (currentSpec: string): Callbacks => ({
  getCurrentSpec: () => currentSpec,
  onDataExtracted: jest.fn<(spec: string, dataFileUrl: string) => void>(),
  onError: jest.fn<(message: string | undefined) => void>(),
})

const renderExtraction = (options: Partial<Callbacks & { uploadTarget: unknown }> & Callbacks) =>
  renderHook(() =>
    useInlineDataExtraction({
      uploadTarget: UPLOAD_TARGET,
      ...options,
    } as Parameters<typeof useInlineDataExtraction>[0]),
  )

/** Lets pending promises settle inside act(), which awaiting the real work would also do. */
const flushPromises = () => Promise.resolve()

const noop = () => undefined

beforeEach(() => {
  jest.useFakeTimers()
  uploadFileFromPage.mockReset()
  uploadFileFromPage.mockResolvedValue({ url: "/uploads/chart-data.json" })
})

afterEach(() => {
  jest.useRealTimers()
})

/** Runs the scheduled extraction and lets its upload promise settle. */
const runScheduledExtraction = async () => {
  await act(async () => {
    jest.advanceTimersByTime(PAST_THE_DEBOUNCE_MS)
    await flushPromises()
  })
}

describe("useInlineDataExtraction", () => {
  it("waits for editing to pause before uploading", async () => {
    const cbs = callbacks(specWithInlineData)
    const { result } = renderExtraction(cbs)

    act(() => result.current.scheduleExtraction(specWithInlineData))
    expect(uploadFileFromPage).not.toHaveBeenCalled()

    await runScheduledExtraction()
    expect(uploadFileFromPage).toHaveBeenCalledTimes(1)
  })

  it("uploads once for a burst of edits, using the last of them", async () => {
    const lastSpec = JSON.stringify({ mark: "line", data: { values: [{ a: 2 }] } })
    const cbs = callbacks(lastSpec)
    const { result } = renderExtraction(cbs)

    act(() => {
      result.current.scheduleExtraction(specWithInlineData)
      result.current.scheduleExtraction(lastSpec)
    })
    await runScheduledExtraction()

    expect(uploadFileFromPage).toHaveBeenCalledTimes(1)
    const rewritten = JSON.parse(cbs.onDataExtracted.mock.calls[0]?.[0] ?? "{}")
    expect(rewritten.mark).toBe("line")
  })

  it("hands back the spec pointed at the uploaded file", async () => {
    const cbs = callbacks(specWithInlineData)
    const { result } = renderExtraction(cbs)

    act(() => result.current.scheduleExtraction(specWithInlineData))
    await runScheduledExtraction()

    expect(cbs.onDataExtracted).toHaveBeenCalledTimes(1)
    const [rewrittenSpec, url] = cbs.onDataExtracted.mock.calls[0] ?? []
    expect(url).toBe("/uploads/chart-data.json")
    expect(JSON.parse(rewrittenSpec ?? "{}")).toEqual({
      mark: "bar",
      data: { url: "/uploads/chart-data.json", format: { type: "json" } },
    })
    await waitFor(() => expect(result.current.extractedDataUrl).toBe("/uploads/chart-data.json"))
  })

  it("reports that it is extracting only while the upload is in flight", async () => {
    let finishUpload: (item: MediaItem) => void = noop
    uploadFileFromPage.mockReturnValue(
      new Promise<MediaItem>((resolve) => {
        finishUpload = resolve
      }),
    )
    const cbs = callbacks(specWithInlineData)
    const { result } = renderExtraction(cbs)

    act(() => result.current.scheduleExtraction(specWithInlineData))
    expect(result.current.isExtracting).toBe(false)

    await runScheduledExtraction()
    expect(result.current.isExtracting).toBe(true)

    await act(async () => {
      finishUpload({ url: "/uploads/chart-data.json" })
      await flushPromises()
    })
    expect(result.current.isExtracting).toBe(false)
  })

  it("discards the upload when the spec changed while it was in flight", async () => {
    const cbs = callbacks("the teacher kept typing")
    const { result } = renderExtraction(cbs)

    act(() => result.current.scheduleExtraction(specWithInlineData))
    await runScheduledExtraction()

    expect(uploadFileFromPage).toHaveBeenCalledTimes(1)
    expect(cbs.onDataExtracted).not.toHaveBeenCalled()
  })

  it("retries after an in-flight upload instead of leaving the newer data inline", async () => {
    let finishFirstUpload: (item: MediaItem) => void = noop
    uploadFileFromPage.mockReturnValueOnce(
      new Promise<MediaItem>((resolve) => {
        finishFirstUpload = resolve
      }),
    )
    const cbs = callbacks(specWithInlineData)
    const { result } = renderExtraction(cbs)

    act(() => result.current.scheduleExtraction(specWithInlineData))
    await runScheduledExtraction()
    // A second edit lands while the first upload is still going.
    act(() => result.current.scheduleExtraction(specWithInlineData))
    await runScheduledExtraction()
    expect(uploadFileFromPage).toHaveBeenCalledTimes(1)

    await act(async () => {
      finishFirstUpload({ url: "/uploads/first.json" })
      await flushPromises()
    })
    await runScheduledExtraction()

    expect(uploadFileFromPage).toHaveBeenCalledTimes(2)
  })

  it("does nothing for a spec whose data is already a file", async () => {
    const urlSpec = JSON.stringify({ mark: "bar", data: { url: "/uploads/data.csv" } })
    const cbs = callbacks(urlSpec)
    const { result } = renderExtraction(cbs)

    act(() => result.current.scheduleExtraction(urlSpec))
    await runScheduledExtraction()

    expect(uploadFileFromPage).not.toHaveBeenCalled()
    expect(cbs.onDataExtracted).not.toHaveBeenCalled()
  })

  it("does not upload when the page belongs to neither a course nor an exam", async () => {
    const cbs = callbacks(specWithInlineData)
    const { result } = renderExtraction({ ...cbs, uploadTarget: null })

    act(() => result.current.scheduleExtraction(specWithInlineData))
    await runScheduledExtraction()

    expect(uploadFileFromPage).not.toHaveBeenCalled()
  })

  it("clears a previous error when a new extraction starts, and reports a failed upload", async () => {
    uploadFileFromPage.mockRejectedValue(new Error("storage is full"))
    const cbs = callbacks(specWithInlineData)
    const { result } = renderExtraction(cbs)

    act(() => result.current.scheduleExtraction(specWithInlineData))
    await runScheduledExtraction()

    expect(cbs.onError.mock.calls).toEqual([[undefined], ["storage is full"]])
    expect(result.current.isExtracting).toBe(false)
  })

  it("does not upload a cancelled extraction", async () => {
    const cbs = callbacks(specWithInlineData)
    const { result } = renderExtraction(cbs)

    act(() => result.current.scheduleExtraction(specWithInlineData))
    act(() => result.current.cancelScheduledExtraction())
    await runScheduledExtraction()

    expect(uploadFileFromPage).not.toHaveBeenCalled()
  })

  it("forgets the extracted file when asked", async () => {
    const cbs = callbacks(specWithInlineData)
    const { result } = renderExtraction(cbs)

    act(() => result.current.scheduleExtraction(specWithInlineData))
    await runScheduledExtraction()
    await waitFor(() => expect(result.current.extractedDataUrl).toBeDefined())

    act(() => result.current.clearExtractedDataUrl())
    expect(result.current.extractedDataUrl).toBeUndefined()
  })

  it("does not upload an extraction scheduled just before unmounting", async () => {
    const cbs = callbacks(specWithInlineData)
    const { result, unmount } = renderExtraction(cbs)

    act(() => result.current.scheduleExtraction(specWithInlineData))
    unmount()
    await runScheduledExtraction()

    expect(uploadFileFromPage).not.toHaveBeenCalled()
  })
})
