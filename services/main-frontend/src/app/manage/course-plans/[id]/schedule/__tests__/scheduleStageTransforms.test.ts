/// <reference types="jest" />

import { addMonths, endOfMonth, format, parseISO, startOfMonth } from "date-fns"

import { addMonthToStage, removeMonthFromStage } from "../scheduleStageTransforms"

import {
  CourseDesignerScheduleStageInput,
  CourseDesignerStage,
} from "@/services/backend/courseDesigner"

const STAGE_ORDER: CourseDesignerStage[] = [
  "Analysis",
  "Design",
  "Development",
  "Implementation",
  "Evaluation",
]

const makeStage = (
  stage: CourseDesignerStage,
  start: Date,
  monthCount: number,
): CourseDesignerScheduleStageInput => {
  const startMonth = startOfMonth(start)
  const endMonth = endOfMonth(addMonths(startMonth, monthCount - 1))
  return {
    stage,
    planned_starts_on: format(startMonth, "yyyy-MM-dd"),
    planned_ends_on: format(endMonth, "yyyy-MM-dd"),
  }
}

const buildContiguousStages = (
  totalMonthsPerStage: number[],
): CourseDesignerScheduleStageInput[] => {
  let cursor = startOfMonth(new Date(2026, 1, 1)) // Feb 2026
  const stages: CourseDesignerScheduleStageInput[] = []

  STAGE_ORDER.forEach((stage, idx) => {
    const months = totalMonthsPerStage[idx]
    stages.push(makeStage(stage, cursor, months))
    cursor = addMonths(cursor, months)
  })

  return stages
}

const countMonthsForStage = (stage: CourseDesignerScheduleStageInput): number => {
  const start = startOfMonth(parseISO(stage.planned_starts_on))
  const end = endOfMonth(parseISO(stage.planned_ends_on))
  let count = 0
  let current = start
  while (current <= end) {
    count += 1
    current = addMonths(current, 1)
  }
  return count
}

describe("scheduleStageTransforms", () => {
  it("adds a month to the first stage and keeps plan contiguous", () => {
    const original = buildContiguousStages([2, 2, 2, 2, 2])
    const updated = addMonthToStage(original, 0)
    expect(updated).not.toBeNull()
    const stages = updated!

    expect(countMonthsForStage(stages[0])).toBe(3)
    expect(countMonthsForStage(stages[1])).toBe(2)
    expect(countMonthsForStage(stages[2])).toBe(2)
    expect(countMonthsForStage(stages[3])).toBe(2)
    expect(countMonthsForStage(stages[4])).toBe(2)
  })

  it("adds a month to the last stage and extends the plan", () => {
    const original = buildContiguousStages([2, 2, 2, 2, 2])
    const updated = addMonthToStage(original, 4)
    expect(updated).not.toBeNull()
    const stages = updated!

    expect(countMonthsForStage(stages[4])).toBe(3)
  })

  it("adds a month to a middle stage and keeps other lengths", () => {
    const original = buildContiguousStages([2, 2, 2, 2, 2])
    const updated = addMonthToStage(original, 2)
    expect(updated).not.toBeNull()
    const stages = updated!

    expect(countMonthsForStage(stages[0])).toBe(2)
    expect(countMonthsForStage(stages[1])).toBe(2)
    expect(countMonthsForStage(stages[2])).toBe(3)
    expect(countMonthsForStage(stages[3])).toBe(2)
    expect(countMonthsForStage(stages[4])).toBe(2)
  })

  it("removes a month from the first stage when it has more than one month", () => {
    const original = buildContiguousStages([3, 2, 2, 2, 2])
    const updated = removeMonthFromStage(original, 0)
    expect(updated).not.toBeNull()
    const stages = updated!

    expect(countMonthsForStage(stages[0])).toBe(2)
  })

  it("does not remove a month from a stage with only one month", () => {
    const original = buildContiguousStages([1, 2, 2, 2, 2])
    const updated = removeMonthFromStage(original, 0)
    expect(updated).toBeNull()
  })

  it("removes a month from the last stage when it has more than one month", () => {
    const original = buildContiguousStages([2, 2, 2, 2, 3])
    const updated = removeMonthFromStage(original, 4)
    expect(updated).not.toBeNull()
    const stages = updated!

    expect(countMonthsForStage(stages[4])).toBe(2)
  })

  it("removes a month from a middle stage and keeps others the same length", () => {
    const original = buildContiguousStages([2, 2, 3, 2, 2])
    const updated = removeMonthFromStage(original, 2)
    expect(updated).not.toBeNull()
    const stages = updated!

    expect(countMonthsForStage(stages[2])).toBe(2)
    expect(countMonthsForStage(stages[0])).toBe(2)
    expect(countMonthsForStage(stages[1])).toBe(2)
    expect(countMonthsForStage(stages[3])).toBe(2)
    expect(countMonthsForStage(stages[4])).toBe(2)
  })
})
