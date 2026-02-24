import { addMonths, endOfMonth, format, parseISO, startOfMonth } from "date-fns"

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

type StageInput = CourseDesignerScheduleStageInput

type MonthWithStage = {
  date: Date
  stage: CourseDesignerStage
}

/** Builds a flat month timeline (one entry per calendar month) from the 5 stage ranges. */
export const buildMonthTimeline = (stages: StageInput[]): MonthWithStage[] | null => {
  if (stages.length !== 5) {
    return null
  }

  const firstStage = stages[0]
  const lastStage = stages[stages.length - 1]

  const planStart = startOfMonth(parseISO(firstStage.planned_starts_on))
  const planEnd = endOfMonth(parseISO(lastStage.planned_ends_on))

  const months: MonthWithStage[] = []
  let current = planStart

  while (current <= planEnd) {
    const owningStage = stages.find((stage) => {
      const stageStart = startOfMonth(parseISO(stage.planned_starts_on))
      const stageEnd = endOfMonth(parseISO(stage.planned_ends_on))
      return current >= stageStart && current <= stageEnd
    })

    if (!owningStage) {
      return null
    }

    months.push({ date: current, stage: owningStage.stage })
    current = addMonths(current, 1)
  }

  return months
}

const toStageRanges = (months: MonthWithStage[]): StageInput[] => {
  const result: StageInput[] = []

  STAGE_ORDER.forEach((stage) => {
    const stageMonths = months.filter((m) => m.stage === stage)
    if (stageMonths.length === 0) {
      throw new Error("Stage has no months when rebuilding ranges")
    }
    const first = stageMonths[0].date
    const last = stageMonths[stageMonths.length - 1].date
    result.push({
      stage,
      planned_starts_on: format(startOfMonth(first), "yyyy-MM-dd"),
      planned_ends_on: format(endOfMonth(last), "yyyy-MM-dd"),
    })
  })

  return result
}

/** Adds one month at the end of the given stage, cascading later stages; plan length +1. */
export const addMonthToStage = (stages: StageInput[], stageIndex: number): StageInput[] | null => {
  const months = buildMonthTimeline(stages)
  if (!months) {
    return null
  }
  if (stageIndex < 0 || stageIndex >= STAGE_ORDER.length) {
    return null
  }

  const lastDate = months[months.length - 1]?.date
  if (!lastDate) {
    return null
  }

  const lengths: number[] = STAGE_ORDER.map(
    (stage) => months.filter((m) => m.stage === stage).length,
  )

  lengths[stageIndex] += 1

  const newLastDate = addMonths(lastDate, 1)
  months.push({ date: newLastDate, stage: STAGE_ORDER[STAGE_ORDER.length - 1] })

  const newMonths: MonthWithStage[] = []
  let cursor = 0
  STAGE_ORDER.forEach((stage, idx) => {
    const len = lengths[idx]
    for (let i = 0; i < len; i += 1) {
      const source = months[cursor]
      if (!source) {
        throw new Error("Month index out of bounds while assigning stages")
      }
      newMonths.push({ date: source.date, stage })
      cursor += 1
    }
  })

  return toStageRanges(newMonths)
}

/** Removes one month from the end of the given stage, cascading later stages; plan length -1. */
export const removeMonthFromStage = (
  stages: StageInput[],
  stageIndex: number,
): StageInput[] | null => {
  const months = buildMonthTimeline(stages)
  if (!months) {
    return null
  }
  if (stageIndex < 0 || stageIndex >= STAGE_ORDER.length) {
    return null
  }

  const lengths: number[] = STAGE_ORDER.map(
    (stage) => months.filter((m) => m.stage === stage).length,
  )

  if (lengths[stageIndex] <= 1) {
    return null
  }

  months.pop()
  lengths[stageIndex] -= 1

  const newMonths: MonthWithStage[] = []
  let cursor = 0
  STAGE_ORDER.forEach((stage, idx) => {
    const len = lengths[idx]
    for (let i = 0; i < len; i += 1) {
      const source = months[cursor]
      if (!source) {
        throw new Error("Month index out of bounds while assigning stages")
      }
      newMonths.push({ date: source.date, stage })
      cursor += 1
    }
  })

  return toStageRanges(newMonths)
}
