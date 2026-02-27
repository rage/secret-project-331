import { CourseDesignerStage } from "@/services/backend/courseDesigner"

export const SCHEDULE_STAGE_ORDER: CourseDesignerStage[] = [
  "Analysis",
  "Design",
  "Development",
  "Implementation",
  "Evaluation",
]

export const SCHEDULE_STAGE_COUNT = SCHEDULE_STAGE_ORDER.length

export const SCHEDULE_WIZARD_STEPS = ["name", "setup", "schedule"] as const

export type ScheduleWizardStepId = (typeof SCHEDULE_WIZARD_STEPS)[number]
