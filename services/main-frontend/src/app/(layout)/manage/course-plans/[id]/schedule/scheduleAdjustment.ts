import { addDays, differenceInCalendarDays, isValid, parseISO } from "date-fns"

import type {
  CourseDesignerPlanStageStatus,
  CourseDesignerScheduleStageInput,
  CourseDesignerStage,
} from "@/generated/api/types.generated"

import { toIsoDate } from "../../coursePlanDates"

type StageInput = CourseDesignerScheduleStageInput

export interface AdjustableStage extends StageInput {
  status: CourseDesignerPlanStageStatus
}

export type ScheduleAdjustmentIssue =
  | { code: "invalid_date"; stage: CourseDesignerStage }
  | { code: "ends_before_start"; stage: CourseDesignerStage }
  | { code: "completed_stage_changed"; stage: CourseDesignerStage }

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value))
}

function shiftIsoDate(isoDate: string, days: number): string {
  return toIsoDate(addDays(parseISO(isoDate), days))
}

/**
 * Moves one stage's end date and shifts every later stage so the next one starts the day after
 * `newEndsOn`, keeping the schedule contiguous and later stages at their lengths. Mirrors what the
 * backend expects from an adjustment request.
 *
 * Returns the stages unchanged when `newEndsOn` is not a valid ISO date.
 */
export function moveStageEnd(
  stages: StageInput[],
  stageIndex: number,
  newEndsOn: string,
): StageInput[] {
  const target = stages[stageIndex]
  if (target === undefined || !isIsoDate(newEndsOn)) {
    return stages
  }
  // The target's own end may be a cleared field, so measure the shift from the next stage's start.
  const nextStartsOn = stages[stageIndex + 1]?.planned_starts_on
  const shiftDays =
    nextStartsOn !== undefined && isIsoDate(nextStartsOn)
      ? differenceInCalendarDays(addDays(parseISO(newEndsOn), 1), parseISO(nextStartsOn))
      : 0
  return stages.map((stage, index) => {
    if (index < stageIndex) {
      return stage
    }
    if (index === stageIndex) {
      return { ...stage, planned_ends_on: newEndsOn }
    }
    return {
      ...stage,
      planned_starts_on: shiftIsoDate(stage.planned_starts_on, shiftDays),
      planned_ends_on: shiftIsoDate(stage.planned_ends_on, shiftDays),
    }
  })
}

/** Whether the stage's start date may be edited: only the first stage has no previous end to follow. */
export function canEditStageStart(stages: AdjustableStage[], stageIndex: number): boolean {
  return stageIndex === 0 && stages[0]?.status !== "Completed"
}

/** Whether the stage's end date may be edited. Completed stages keep their dates. */
export function canEditStageEnd(stages: AdjustableStage[], stageIndex: number): boolean {
  const stage = stages[stageIndex]
  return stage !== undefined && stage.status !== "Completed"
}

/**
 * First reason the adjusted schedule would be refused, or `null` when it can be saved.
 * `original` carries each stage's status; `adjusted` is the same stages in the same order.
 */
export function findScheduleAdjustmentIssue(
  original: AdjustableStage[],
  adjusted: StageInput[],
): ScheduleAdjustmentIssue | null {
  for (const stage of adjusted) {
    if (!isIsoDate(stage.planned_starts_on) || !isIsoDate(stage.planned_ends_on)) {
      return { code: "invalid_date", stage: stage.stage }
    }
    if (stage.planned_ends_on < stage.planned_starts_on) {
      return { code: "ends_before_start", stage: stage.stage }
    }
  }
  for (const stage of original) {
    if (stage.status !== "Completed") {
      continue
    }
    const adjustedStage = adjusted.find((candidate) => candidate.stage === stage.stage)
    if (
      adjustedStage === undefined ||
      adjustedStage.planned_starts_on !== stage.planned_starts_on ||
      adjustedStage.planned_ends_on !== stage.planned_ends_on
    ) {
      return { code: "completed_stage_changed", stage: stage.stage }
    }
  }
  return null
}
