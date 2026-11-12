"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { baseTheme } from "@/shared-module/common/styles"

import { stageLabel } from "../../../../coursePlanStages"
import GuidanceText from "../GuidanceText"
import { type FormlessStage, STAGE_SECTION_KEYS } from "../section-status/sectionKeys"
import { SectionStatusBadge } from "../section-status/SectionStatusBadge"
import SectionStatusEditor from "../section-status/SectionStatusEditor"

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

const headerStyles = css`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
`

const headingStyles = css`
  font-size: 1.15rem;
  font-weight: 600;
  color: ${baseTheme.colors.gray[900]};
  margin: 0;
`

const GUIDANCE_KEYS = {
  Development: "course-plans-guidance-development",
  Implementation: "course-plans-guidance-implementation",
  Evaluation: "course-plans-guidance-evaluation",
} as const satisfies Record<FormlessStage, string>

/** Guidance for a stage without a form, with the stage's single Ready/Unfinished mark. */
export default function StageGuidance(props: { stage: FormlessStage }) {
  const { stage } = props
  const { t } = useTranslation()
  const sectionKey = STAGE_SECTION_KEYS[stage]
  const headingId = `stage-guidance-${stage}`
  return (
    <section className={cardStyles} aria-labelledby={headingId}>
      <div className={headerStyles}>
        <h4 className={headingStyles} id={headingId}>
          {stageLabel(stage, t)}
        </h4>
        <SectionStatusBadge stage={stage} sectionKey={sectionKey} />
      </div>
      <GuidanceText text={t(GUIDANCE_KEYS[stage])} />
      <SectionStatusEditor stage={stage} sectionKey={sectionKey} />
    </section>
  )
}
