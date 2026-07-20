import { addMonths, endOfMonth, format, parseISO, startOfMonth } from "date-fns"

import type {
  CourseDesignerPlanStage,
  CourseDesignerScheduleStageInput,
  CourseDesignerStage,
} from "@/generated/api/types.generated"

import { SCHEDULE_STAGE_COUNT, SCHEDULE_STAGE_ORDER } from "./scheduleConstants"

type StageRangeLike = Pick<
  CourseDesignerPlanStage,
  "stage" | "planned_starts_on" | "planned_ends_on"
>

export interface StageMonth {
  id: string
  date: Date
  label: string
}

export interface StageCardViewModel {
  stage: CourseDesignerStage
  months: StageMonth[]
  canShrink: boolean
}

export function toDraftStages(stages: StageRangeLike[]): CourseDesignerScheduleStageInput[] {
  return stages.map((stage) => ({
    stage: stage.stage,
    planned_starts_on: stage.planned_starts_on,
    planned_ends_on: stage.planned_ends_on,
  }))
}

export function getStartsOnMonthFromStages(
  stages: Pick<CourseDesignerScheduleStageInput, "planned_starts_on">[],
): string | null {
  return stages[0]?.planned_starts_on?.slice(0, 7) ?? null
}

export function getStageMonths(stage: CourseDesignerScheduleStageInput): StageMonth[] {
  const start = startOfMonth(parseISO(stage.planned_starts_on))
  const end = endOfMonth(parseISO(stage.planned_ends_on))
  const months: StageMonth[] = []
  let current = start

  while (current <= end) {
    months.push({
      id: format(current, "yyyy-MM"),
      date: current,
      label: format(current, "MMM yyyy"),
    })
    current = addMonths(current, 1)
  }

  return months
}

export function buildStageCardViewModels(
  stages: CourseDesignerScheduleStageInput[],
): StageCardViewModel[] {
  if (stages.length !== SCHEDULE_STAGE_COUNT) {
    return []
  }

  const byStage = new Map<CourseDesignerStage, CourseDesignerScheduleStageInput>()
  stages.forEach((stage) => {
    byStage.set(stage.stage, stage)
  })

  return SCHEDULE_STAGE_ORDER.map((stage) => {
    const stageInput = byStage.get(stage)
    const months = stageInput ? getStageMonths(stageInput) : []
    return {
      stage,
      months,
      canShrink: months.length > 1,
    }
  })
}
