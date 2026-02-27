import { addMonths, endOfMonth, format, parseISO, startOfMonth } from "date-fns"

import { SCHEDULE_STAGE_ORDER } from "./scheduleConstants"

import {
  CourseDesignerScheduleStageInput,
  CourseDesignerStage,
} from "@/services/backend/courseDesigner"

const STAGE_ORDER: CourseDesignerStage[] = SCHEDULE_STAGE_ORDER

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

  const byStage = new Map<CourseDesignerStage, StageInput>()
  stages.forEach((stage) => {
    byStage.set(stage.stage, stage)
  })

  for (const stage of STAGE_ORDER) {
    if (!byStage.has(stage)) {
      return null
    }
  }

  const starts = STAGE_ORDER.map((stage) =>
    startOfMonth(parseISO(byStage.get(stage)!.planned_starts_on)),
  )
  const ends = STAGE_ORDER.map((stage) => endOfMonth(parseISO(byStage.get(stage)!.planned_ends_on)))

  const planStart = starts.reduce((a, b) => (a < b ? a : b))
  const planEnd = ends.reduce((a, b) => (a > b ? a : b))

  const months: MonthWithStage[] = []
  let current = planStart

  while (current <= planEnd) {
    const owningStage = STAGE_ORDER.find((stage) => {
      const input = byStage.get(stage)
      if (!input) {
        return false
      }
      const stageStart = startOfMonth(parseISO(input.planned_starts_on))
      const stageEnd = endOfMonth(parseISO(input.planned_ends_on))
      return current >= stageStart && current <= stageEnd
    })

    if (!owningStage) {
      return null
    }

    months.push({ date: current, stage: owningStage })
    current = addMonths(current, 1)
  }

  return months
}

const toStageRanges = (months: MonthWithStage[]): StageInput[] | null => {
  const result: StageInput[] = []

  for (const stage of STAGE_ORDER) {
    const stageMonths = months.filter((m) => m.stage === stage)
    if (stageMonths.length === 0) {
      return null
    }
    const first = stageMonths[0].date
    const last = stageMonths[stageMonths.length - 1].date
    result.push({
      stage,
      planned_starts_on: format(startOfMonth(first), "yyyy-MM-dd"),
      planned_ends_on: format(endOfMonth(last), "yyyy-MM-dd"),
    })
  }

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
  for (let idx = 0; idx < STAGE_ORDER.length; idx += 1) {
    const stage = STAGE_ORDER[idx]
    const len = lengths[idx]
    for (let i = 0; i < len; i += 1) {
      const source = months[cursor]
      if (!source) {
        return null
      }
      newMonths.push({ date: source.date, stage })
      cursor += 1
    }
  }

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
  for (let idx = 0; idx < STAGE_ORDER.length; idx += 1) {
    const stage = STAGE_ORDER[idx]
    const len = lengths[idx]
    for (let i = 0; i < len; i += 1) {
      const source = months[cursor]
      if (!source) {
        return null
      }
      newMonths.push({ date: source.date, stage })
      cursor += 1
    }
  }

  return toStageRanges(newMonths)
}
