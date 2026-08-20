import {
  guidedStepNumber,
  resolveInitialStep,
  STEP_AI,
  STEP_DATA,
  STEP_EDITOR,
  STEP_METHOD,
} from "../../../src/blocks/ChartBlock/chartEditorSteps"
import { VEGA_LITE_SCHEMA_URL } from "../../../src/blocks/ChartBlock/chartSpec"

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
