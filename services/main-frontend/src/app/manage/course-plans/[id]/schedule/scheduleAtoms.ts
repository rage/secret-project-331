import { atom } from "jotai"
import { atomFamily } from "jotai/utils"

import { addMonthToStage, removeMonthFromStage } from "./scheduleStageTransforms"

import { CourseDesignerScheduleStageInput } from "@/services/backend/courseDesigner"

export const draftStagesAtomFamily = atomFamily((_planId: string) =>
  atom<CourseDesignerScheduleStageInput[]>([]),
)

export const addMonthToStageAtomFamily = atomFamily((planId: string) =>
  atom(null, (get, set, stageIndex: number) => {
    const stages = get(draftStagesAtomFamily(planId))
    const updated = addMonthToStage(stages, stageIndex)
    if (updated) {
      set(draftStagesAtomFamily(planId), updated)
    }
  }),
)

export const removeMonthFromStageAtomFamily = atomFamily((planId: string) =>
  atom(null, (get, set, stageIndex: number) => {
    const stages = get(draftStagesAtomFamily(planId))
    const updated = removeMonthFromStage(stages, stageIndex)
    if (updated) {
      set(draftStagesAtomFamily(planId), updated)
    }
  }),
)

export type ScheduleWizardStep = 0 | 1 | 2

export const scheduleWizardStepAtomFamily = atomFamily((_planId: string) =>
  atom<ScheduleWizardStep>(0),
)
