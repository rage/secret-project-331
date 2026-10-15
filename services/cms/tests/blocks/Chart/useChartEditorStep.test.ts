import { act, renderHook } from "@testing-library/react"

import { VEGA_LITE_SCHEMA_URL } from "../../../src/blocks/Chart/chartSpec"
import {
  guidedStepNumber,
  resolveInitialStep,
  STEP_AI,
  STEP_DATA,
  STEP_EDITOR,
  STEP_METHOD,
  useChartEditorStep,
} from "../../../src/blocks/Chart/useChartEditorStep"

const dataOnlySpec = JSON.stringify({
  $schema: VEGA_LITE_SCHEMA_URL,
  data: { url: "/files/data.csv", format: { type: "csv" } },
})

const finishedSpec = JSON.stringify({
  $schema: VEGA_LITE_SCHEMA_URL,
  data: { url: "/files/data.csv", format: { type: "csv" } },
  mark: "bar",
  encoding: { x: { field: "category", type: "nominal" } },
})

describe("resolveInitialStep", () => {
  it("starts a brand-new block on the data-file step", () => {
    expect(resolveInitialStep("")).toBe(STEP_DATA)
    expect(resolveInitialStep(undefined)).toBe(STEP_DATA)
    expect(resolveInitialStep("   \n")).toBe(STEP_DATA)
  })

  it("opens a finished chart straight in the editor", () => {
    expect(resolveInitialStep(finishedSpec)).toBe(STEP_EDITOR)
  })

  it("resumes at the method step when only the data file was added", () => {
    expect(resolveInitialStep(dataOnlySpec)).toBe(STEP_METHOD)
  })

  it("opens a spec that isn't valid JSON in the editor, where it can be repaired", () => {
    expect(resolveInitialStep("{ not json")).toBe(STEP_EDITOR)
  })

  it("goes back to the data step when a viewless spec has no data file", () => {
    expect(resolveInitialStep(JSON.stringify({ $schema: VEGA_LITE_SCHEMA_URL }))).toBe(STEP_DATA)
    // Inline data has not been lifted into a file yet, so there is nothing to build a chart from.
    expect(resolveInitialStep(JSON.stringify({ data: { values: [{ a: 1 }] } }))).toBe(STEP_DATA)
  })

  it("sends a spec with a view to the editor even without a data file", () => {
    expect(resolveInitialStep(JSON.stringify({ mark: "bar" }))).toBe(STEP_EDITOR)
  })
})

describe("guidedStepNumber", () => {
  it("numbers the three guided steps in order", () => {
    expect(guidedStepNumber(STEP_DATA, STEP_METHOD)).toBe(1)
    expect(guidedStepNumber(STEP_METHOD, STEP_METHOD)).toBe(2)
    expect(guidedStepNumber(STEP_AI, STEP_METHOD)).toBe(3)
  })

  it("does not number the editor", () => {
    expect(guidedStepNumber(STEP_EDITOR, STEP_METHOD)).toBeNull()
    expect(guidedStepNumber(STEP_EDITOR, STEP_EDITOR)).toBeNull()
  })

  it("does not number the AI prompt when it was opened from the editor to re-generate", () => {
    expect(guidedStepNumber(STEP_AI, STEP_EDITOR)).toBeNull()
  })
})

describe("useChartEditorStep", () => {
  it("walks a new block through the guided flow into the editor", () => {
    const { result } = renderHook(() => useChartEditorStep(""))

    expect(result.current.step).toBe(STEP_DATA)
    expect(result.current.stepNumber).toBe(1)
    expect(result.current.stepCount).toBe(3)

    act(() => result.current.advanceFromDataStep())
    expect(result.current.step).toBe(STEP_METHOD)
    expect(result.current.stepNumber).toBe(2)

    act(() => result.current.goToEditorStep())
    expect(result.current.step).toBe(STEP_EDITOR)
    expect(result.current.stepNumber).toBeNull()
  })

  it("leaves a teacher who has moved on where they are", () => {
    const { result } = renderHook(() => useChartEditorStep(""))

    act(() => result.current.goToEditorStep())
    // The media upload calls back twice, so the second call can land after the teacher moved on.
    act(() => result.current.advanceFromDataStep())

    expect(result.current.step).toBe(STEP_EDITOR)
  })

  it("counts the AI prompt as the third guided step when opened from the method step", () => {
    const { result } = renderHook(() => useChartEditorStep(""))

    act(() => result.current.goToMethodStep())
    act(() => result.current.openAiPrompt())

    expect(result.current.step).toBe(STEP_AI)
    expect(result.current.stepNumber).toBe(3)
    expect(result.current.isRegenerating).toBe(false)
  })

  it("does not number the AI prompt when it was opened from the editor to re-generate", () => {
    const { result } = renderHook(() => useChartEditorStep(finishedSpec))

    expect(result.current.step).toBe(STEP_EDITOR)
    act(() => result.current.openAiPrompt())

    expect(result.current.step).toBe(STEP_AI)
    expect(result.current.stepNumber).toBeNull()
    expect(result.current.isRegenerating).toBe(true)
  })

  it("returns from the AI prompt to the step it was opened from", () => {
    const { result } = renderHook(() => useChartEditorStep(""))

    act(() => result.current.goToMethodStep())
    act(() => result.current.openAiPrompt())
    act(() => result.current.closeAiPrompt())
    expect(result.current.step).toBe(STEP_METHOD)

    act(() => result.current.goToEditorStep())
    act(() => result.current.openAiPrompt())
    act(() => result.current.closeAiPrompt())
    expect(result.current.step).toBe(STEP_EDITOR)
  })

  it("keeps the step it resolved to when the spec is edited afterwards", () => {
    const { result, rerender } = renderHook((spec: string) => useChartEditorStep(spec), {
      initialProps: "",
    })

    act(() => result.current.goToMethodStep())
    rerender(finishedSpec)

    expect(result.current.step).toBe(STEP_METHOD)
  })
})
