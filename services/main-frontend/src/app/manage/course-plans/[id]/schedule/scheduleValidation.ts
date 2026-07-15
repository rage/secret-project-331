import type {
  CourseDesignerScheduleStageInput,
  CourseDesignerStage,
} from "@/generated/api/types.generated"

import { SCHEDULE_STAGE_COUNT } from "./scheduleConstants"

export type ScheduleValidationIssue =
  | {
      code: "stage_count"
      actualCount: number
    }
  | {
      code: "invalid_range"
      stage: CourseDesignerStage
    }
  | {
      code: "non_contiguous"
      stage: CourseDesignerStage
      expectedStart: string
      actualStart: string
    }

function addOneDayIsoDate(dateOnly: string): string {
  // Use UTC so date-only inputs are stable across local timezones.
  const date = new Date(`${dateOnly}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

export function validateScheduleStages(
  stages: CourseDesignerScheduleStageInput[],
): ScheduleValidationIssue | null {
  if (stages.length !== SCHEDULE_STAGE_COUNT) {
    return { code: "stage_count", actualCount: stages.length }
  }

  for (let i = 0; i < stages.length; i += 1) {
    const stage = stages[i]
    if (stage === undefined) {
      continue
    }
    if (stage.planned_starts_on > stage.planned_ends_on) {
      return { code: "invalid_range", stage: stage.stage }
    }

    const previous = stages[i - 1]
    if (i > 0 && previous !== undefined) {
      const expectedStart = addOneDayIsoDate(previous.planned_ends_on)
      if (stage.planned_starts_on !== expectedStart) {
        return {
          code: "non_contiguous",
          stage: stage.stage,
          expectedStart,
          actualStart: stage.planned_starts_on,
        }
      }
    }
  }

  return null
}
