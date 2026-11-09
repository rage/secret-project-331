/// <reference types="jest" />

import {
  type AdjustableStage,
  canEditStageEnd,
  canEditStageStart,
  findScheduleAdjustmentIssue,
  moveStageEnd,
} from "../scheduleAdjustment"
import { validateScheduleStages } from "../scheduleValidation"

const stages: AdjustableStage[] = [
  {
    stage: "Analysis",
    status: "Completed",
    planned_starts_on: "2026-01-01",
    planned_ends_on: "2026-01-20",
  },
  {
    stage: "Design",
    status: "InProgress",
    planned_starts_on: "2026-01-21",
    planned_ends_on: "2026-03-31",
  },
  {
    stage: "Development",
    status: "NotStarted",
    planned_starts_on: "2026-04-01",
    planned_ends_on: "2026-06-30",
  },
  {
    stage: "Implementation",
    status: "NotStarted",
    planned_starts_on: "2026-07-01",
    planned_ends_on: "2026-07-31",
  },
  {
    stage: "Evaluation",
    status: "NotStarted",
    planned_starts_on: "2026-08-01",
    planned_ends_on: "2026-08-31",
  },
]

describe("moveStageEnd", () => {
  it("shifts later stages by the same number of days and keeps their lengths", () => {
    const adjusted = moveStageEnd(stages, 1, "2026-04-14")

    expect(adjusted[0]).toEqual(stages[0])
    expect(adjusted[1]?.planned_ends_on).toBe("2026-04-14")
    expect(adjusted[2]).toMatchObject({
      planned_starts_on: "2026-04-15",
      planned_ends_on: "2026-07-14",
    })
    expect(adjusted[4]).toMatchObject({
      planned_starts_on: "2026-08-15",
      planned_ends_on: "2026-09-14",
    })
    expect(validateScheduleStages(adjusted)).toBeNull()
    expect(findScheduleAdjustmentIssue(stages, adjusted)).toBeNull()
  })

  it("pulls later stages forward when a stage ends earlier", () => {
    const adjusted = moveStageEnd(stages, 2, "2026-05-31")

    expect(adjusted[3]).toMatchObject({
      planned_starts_on: "2026-06-01",
      planned_ends_on: "2026-07-01",
    })
    expect(validateScheduleStages(adjusted)).toBeNull()
  })

  it("ignores an incomplete date", () => {
    expect(moveStageEnd(stages, 1, "2026-04")).toBe(stages)
  })
})

describe("findScheduleAdjustmentIssue", () => {
  it("reports a stage that ends before it starts", () => {
    const adjusted = moveStageEnd(stages, 1, "2026-01-10")

    expect(findScheduleAdjustmentIssue(stages, adjusted)).toEqual({
      code: "ends_before_start",
      stage: "Design",
    })
  })

  it("reports a change to a completed stage", () => {
    const adjusted = moveStageEnd(stages, 0, "2026-01-25")

    expect(findScheduleAdjustmentIssue(stages, adjusted)).toEqual({
      code: "completed_stage_changed",
      stage: "Analysis",
    })
  })
})

describe("editable dates", () => {
  it("locks completed stages and every start but the first stage's", () => {
    expect(canEditStageEnd(stages, 0)).toBe(false)
    expect(canEditStageEnd(stages, 1)).toBe(true)
    expect(canEditStageStart(stages, 0)).toBe(false)
    expect(canEditStageStart(stages, 1)).toBe(false)
  })
})
