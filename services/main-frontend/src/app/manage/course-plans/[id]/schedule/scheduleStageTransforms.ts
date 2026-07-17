import { addMonths, endOfMonth, format, parseISO, startOfMonth } from "date-fns"

import type {
  CourseDesignerScheduleStageInput,
  CourseDesignerStage,
} from "@/generated/api/types.generated"

import { SCHEDULE_STAGE_ORDER } from "./scheduleConstants"

const STAGE_ORDER: CourseDesignerStage[] = SCHEDULE_STAGE_ORDER

type StageInput = CourseDesignerScheduleStageInput

interface MonthWithStage {
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

  const orderedInputs: StageInput[] = []
  for (const stage of STAGE_ORDER) {
    const input = byStage.get(stage)
    if (!input) {
      return null
    }
    orderedInputs.push(input)
  }

  const starts = orderedInputs.map((input) => startOfMonth(parseISO(input.planned_starts_on)))
  const ends = orderedInputs.map((input) => endOfMonth(parseISO(input.planned_ends_on)))

  const planStart = starts.reduce((a, b) => (a < b ? a : b))
  const planEnd = ends.reduce((a, b) => (a > b ? a : b))

  const months: MonthWithStage[] = []
  let current = planStart

  while (current <= planEnd) {
    // oxlint-disable-next-line eslint/no-loop-func -- find callback runs synchronously; no deferred-closure hazard
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
    const first = stageMonths[0]
    const last = stageMonths[stageMonths.length - 1]
    if (first === undefined || last === undefined) {
      return null
    }
    result.push({
      stage,
      planned_starts_on: format(startOfMonth(first.date), "yyyy-MM-dd"),
      planned_ends_on: format(endOfMonth(last.date), "yyyy-MM-dd"),
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

  const lastDate = months.at(-1)?.date
  if (!lastDate) {
    return null
  }

  const lengths: number[] = STAGE_ORDER.map(
    (stage) => months.filter((m) => m.stage === stage).length,
  )

  lengths[stageIndex] = (lengths[stageIndex] ?? 0) + 1

  const newLastDate = addMonths(lastDate, 1)
  const lastStage = STAGE_ORDER.at(-1)
  if (lastStage === undefined) {
    return null
  }
  months.push({ date: newLastDate, stage: lastStage })

  const newMonths: MonthWithStage[] = []
  let cursor = 0
  for (let idx = 0; idx < STAGE_ORDER.length; idx += 1) {
    const stage = STAGE_ORDER[idx]
    if (stage === undefined) {
      return null
    }
    const len = lengths[idx] ?? 0
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

  const currentLength = lengths[stageIndex]
  if (currentLength !== undefined && currentLength <= 1) {
    return null
  }

  months.pop()
  lengths[stageIndex] = (currentLength ?? 0) - 1

  const newMonths: MonthWithStage[] = []
  let cursor = 0
  for (let idx = 0; idx < STAGE_ORDER.length; idx += 1) {
    const stage = STAGE_ORDER[idx]
    if (stage === undefined) {
      return null
    }
    const len = lengths[idx] ?? 0
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
