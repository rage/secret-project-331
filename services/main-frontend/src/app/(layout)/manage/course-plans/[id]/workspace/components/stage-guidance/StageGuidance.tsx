"use client"

import { css } from "@emotion/css"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import type { CourseDesignerStage } from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"

import { stageLabel } from "../../../../coursePlanStages"
import GuidanceText from "../GuidanceText"

const cardStyles = css`
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1rem 1.1rem;
  border-radius: 0.5rem;
  border: 1px solid ${baseTheme.colors.gray[200]};
  border-left: 4px solid ${baseTheme.colors.green[600]};
  background: ${baseTheme.colors.gray[50]};
`

const headingStyles = css`
  font-size: 1.15rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[900]};
  margin: 0;
`

export type FormlessStage = Extract<
  CourseDesignerStage,
  "Development" | "Implementation" | "Evaluation"
>

const GUIDANCE_KEYS = {
  Development: "course-plans-guidance-development",
  Implementation: "course-plans-guidance-implementation",
  Evaluation: "course-plans-guidance-evaluation",
} as const satisfies Record<FormlessStage, string>

/** Guidance for a stage without a form; `children` follow the guidance text. */
export default function StageGuidance(props: { stage: FormlessStage; children?: ReactNode }) {
  const { stage, children } = props
  const { t } = useTranslation()
  const headingId = `stage-guidance-${stage}`
  return (
    <section className={cardStyles} aria-labelledby={headingId}>
      <h4 className={headingStyles} id={headingId}>
        {stageLabel(stage, t)}
      </h4>
      <GuidanceText text={t(GUIDANCE_KEYS[stage])} />
      {children}
    </section>
  )
}
