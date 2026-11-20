import type { TFunction } from "i18next"

import type { CourseDesignerStage } from "@/generated/api/types.generated"

const STAGE_LABEL_KEYS = {
  Analysis: "course-plans-stage-analysis",
  Design: "course-plans-stage-design",
  Development: "course-plans-stage-development",
  Implementation: "course-plans-stage-implementation",
  Evaluation: "course-plans-stage-evaluation",
} as const satisfies Record<CourseDesignerStage, string>

/** The stage's name as the plan pages show it. */
export function stageLabel(stage: CourseDesignerStage, t: TFunction): string {
  return t(STAGE_LABEL_KEYS[stage])
}

/** The stage a tool argument such as `design` names, ignoring case and whitespace. */
export function stageFromName(name: string): CourseDesignerStage | undefined {
  const wanted = name.trim().toLowerCase()
  return (Object.keys(STAGE_LABEL_KEYS) as CourseDesignerStage[]).find(
    (stage) => stage.toLowerCase() === wanted,
  )
}
