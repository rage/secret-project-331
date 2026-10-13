/**
 * @jest-environment jsdom
 */

"use client"

import { jest } from "@jest/globals"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import React from "react"

const PAGE_ID = "77777777-7777-4777-8777-777777777777"
const DATA_URL = "http://project-331.local/uploads/data.csv"

const RENDERABLE_SPEC = JSON.stringify({
  $schema: "https://vega.github.io/schema/vega-lite/v6.json",
  mark: "bar",
  data: { url: DATA_URL },
  encoding: { x: { field: "a", type: "nominal" } },
})

const BROKEN_SPEC = JSON.stringify({
  $schema: "https://vega.github.io/schema/vega-lite/v6.json",
  mark: "bar",
  data: { url: DATA_URL },
  encoding: { x: { field: "a", type: "not-a-type" } },
})

interface GenerationRequest {
  body: {
    prompt: string
    current_spec: string | null
    data_url: string | null
    data_format: string | null
    data_sample: string | null
    page_id: string | null
  }
}

const requestChartSpecGeneration =
  jest.fn<(request: GenerationRequest) => Promise<{ spec: string }>>()

// Vega-Lite compiles the generated spec to decide whether it renders, and needs two browser APIs
// this environment lacks: structuredClone, and the canvas Vega measures text on.
globalThis.structuredClone ??= (value: unknown) => JSON.parse(JSON.stringify(value))
HTMLCanvasElement.prototype.getContext = (() => null) as HTMLCanvasElement["getContext"]

await jest.unstable_mockModule("@/generated/api/sdk.generated", () => ({
  requestChartSpecGeneration,
}))
await jest.unstable_mockModule("@/utils/useCmsTranslation", () => ({
  useTranslation: () => ({
    // The repair prompt embeds the renderer's error, so the key alone would hide it.
    t: (key: string, options?: Record<string, unknown>) =>
      key === "ai-fix-chart-prompt" ? `fix: ${String(options?.error)}` : key,
    i18n: {},
    ready: true,
  }),
}))

const { useChartSpecGeneration } = await import("@/blocks/Chart/useChartSpecGeneration")

const fetchMock = jest.fn<typeof fetch>()

/** Lets pending promises settle inside act(), which awaiting the real work would also do. */
const flushPromises = () => Promise.resolve()

const noop = () => undefined

beforeEach(() => {
  requestChartSpecGeneration.mockReset()
  requestChartSpecGeneration.mockResolvedValue({ spec: RENDERABLE_SPEC })
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({
    ok: true,
    text: () => Promise.resolve("category,value\nA,1\n"),
  } as Response)
  global.fetch = fetchMock as unknown as typeof fetch
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
)

const renderGeneration = (dataFileUrl: string | undefined) => {
  const onSpecGenerated = jest.fn<(spec: string) => void>()
  const rendered = renderHook(
    () => useChartSpecGeneration({ dataFileUrl, pageId: PAGE_ID, onSpecGenerated }),
    { wrapper },
  )
  return { ...rendered, onSpecGenerated }
}

const requestBody = (call = 0) => requestChartSpecGeneration.mock.calls[call]?.[0].body

/** The spec as applied to the block, which carries the re-bound data file. */
const appliedSpec = (onSpecGenerated: jest.Mock<(spec: string) => void>, call = 0) =>
  JSON.parse(onSpecGenerated.mock.calls[call]?.[0] ?? "{}")

describe("useChartSpecGeneration", () => {
  it("hands the model the prompt, the page, and the data file with a sample of it", async () => {
    const { result, onSpecGenerated } = renderGeneration(DATA_URL)

    await act(async () => {
      await result.current.generateSpec("a bar chart", null)
    })

    expect(fetchMock).toHaveBeenCalledWith(DATA_URL)
    expect(requestBody()).toEqual({
      prompt: "a bar chart",
      current_spec: null,
      data_url: DATA_URL,
      data_format: "csv",
      data_sample: "category,value\nA,1\n",
      page_id: PAGE_ID,
    })
    expect(appliedSpec(onSpecGenerated)).toMatchObject({
      mark: "bar",
      data: { url: DATA_URL, format: { type: "csv" } },
    })
  })

  it("reports that a spec came back", async () => {
    const { result } = renderGeneration(DATA_URL)

    let generated: boolean | undefined
    await act(async () => {
      generated = await result.current.generateSpec("a bar chart", null)
    })

    expect(generated).toBe(true)
  })

  it("generates without a sample when the data file cannot be read", async () => {
    fetchMock.mockRejectedValue(new Error("offline"))
    const { result } = renderGeneration(DATA_URL)

    await act(async () => {
      await result.current.generateSpec("a bar chart", null)
    })

    expect(requestBody()?.data_sample).toBeNull()
    expect(requestChartSpecGeneration).toHaveBeenCalledTimes(1)
  })

  it("asks for no sample at all when the block has no data file", async () => {
    const { result } = renderGeneration(undefined)

    await act(async () => {
      await result.current.generateSpec("a bar chart", null)
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(requestBody()).toMatchObject({ data_url: null, data_format: null, data_sample: null })
  })

  it("re-binds the teacher's data file when the model dropped or changed the URL", async () => {
    requestChartSpecGeneration.mockResolvedValue({
      spec: JSON.stringify({ mark: "bar", data: { url: "http://example.com/somewhere-else.csv" } }),
    })
    const { result, onSpecGenerated } = renderGeneration(DATA_URL)

    await act(async () => {
      await result.current.generateSpec("a bar chart", null)
    })

    expect(appliedSpec(onSpecGenerated).data).toEqual({ url: DATA_URL, format: { type: "csv" } })
  })

  it("retries once with the renderer's error when the spec will not render", async () => {
    requestChartSpecGeneration
      .mockResolvedValueOnce({ spec: BROKEN_SPEC })
      .mockResolvedValueOnce({ spec: RENDERABLE_SPEC })
    const { result, onSpecGenerated } = renderGeneration(DATA_URL)

    await act(async () => {
      await result.current.generateSpec("a bar chart", null)
    })

    expect(requestChartSpecGeneration).toHaveBeenCalledTimes(2)
    const retry = requestBody(1)
    expect(retry?.prompt).toMatch(/^fix: /)
    // The spec it retries with is the broken one, with the teacher's data file re-bound into it.
    expect(JSON.parse(retry?.current_spec ?? "{}")).toMatchObject({
      encoding: { x: { type: "not-a-type" } },
    })
    expect(appliedSpec(onSpecGenerated)).toMatchObject({ encoding: { x: { type: "nominal" } } })
  })

  it("applies a spec that is still broken after the retry, leaving the repair to the teacher", async () => {
    requestChartSpecGeneration.mockResolvedValue({ spec: BROKEN_SPEC })
    const { result, onSpecGenerated } = renderGeneration(DATA_URL)

    await act(async () => {
      await result.current.generateSpec("a bar chart", null)
    })

    expect(requestChartSpecGeneration).toHaveBeenCalledTimes(2)
    expect(appliedSpec(onSpecGenerated)).toMatchObject({ encoding: { x: { type: "not-a-type" } } })
  })

  it("edits the spec the teacher already has when there is one", async () => {
    const { result } = renderGeneration(DATA_URL)

    await act(async () => {
      await result.current.generateSpec("make the bars blue", RENDERABLE_SPEC)
    })

    expect(requestBody()?.current_spec).toBe(RENDERABLE_SPEC)
  })

  it("reports a failed request instead of applying anything", async () => {
    requestChartSpecGeneration.mockRejectedValue(new Error("the model is down"))
    const { result, onSpecGenerated } = renderGeneration(DATA_URL)

    let generated: boolean | undefined
    await act(async () => {
      generated = await result.current.generateSpec("a bar chart", null)
    })

    expect(generated).toBe(false)
    expect(onSpecGenerated).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))
  })

  it("clears a previous failure when asked, so the prompt reopens clean", async () => {
    requestChartSpecGeneration.mockRejectedValue(new Error("the model is down"))
    const { result } = renderGeneration(DATA_URL)
    await act(async () => {
      await result.current.generateSpec("a bar chart", null)
    })
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))

    act(() => result.current.reset())

    await waitFor(() => expect(result.current.error).toBeNull())
  })

  it("repairs a broken spec with the error it was given", async () => {
    const { result, onSpecGenerated } = renderGeneration(DATA_URL)

    act(() => result.current.repairSpec("Invalid field type", BROKEN_SPEC))

    await waitFor(() => expect(onSpecGenerated).toHaveBeenCalled())
    expect(requestBody()).toMatchObject({
      prompt: "fix: Invalid field type",
      current_spec: BROKEN_SPEC,
    })
  })

  it("says while it is generating", async () => {
    let finishRequest: (response: { spec: string }) => void = noop
    requestChartSpecGeneration.mockReturnValue(
      new Promise((resolve) => {
        finishRequest = resolve
      }),
    )
    const { result } = renderGeneration(DATA_URL)

    act(() => {
      void result.current.generateSpec("a bar chart", null)
    })
    await waitFor(() => expect(result.current.isGenerating).toBe(true))

    await act(async () => {
      finishRequest({ spec: RENDERABLE_SPEC })
      await flushPromises()
    })

    await waitFor(() => expect(result.current.isGenerating).toBe(false))
  })
})
