"use client"

import { css, cx } from "@emotion/css"
import { CheckCircle, Clock } from "@vectopus/atlas-icons-react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import type { CourseDesignerStage } from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { Badge, TONE } from "@/shared-module/components"

import { useSectionStatuses } from "./SectionStatusContext"

const ICON_SIZE = 12

const dotStyles = css`
  display: inline-flex;
  align-items: center;
  margin-left: 0.35rem;
`

const readyDotStyles = css`
  color: ${baseTheme.colors.green[600]};
`

const unfinishedDotStyles = css`
  color: ${baseTheme.colors.gray[600]};
`

/** Ready/Unfinished chip for a section header; shows "Not marked" when nobody has marked it. */
export function SectionStatusBadge(props: { stage: CourseDesignerStage; sectionKey: string }) {
  const { t } = useTranslation()
  const { findStatus } = useSectionStatuses()
  const status = findStatus(props.stage, props.sectionKey)?.status ?? null

  if (status === "Ready") {
    return (
      <Badge tone={TONE.SUCCESS} icon={<CheckCircle size={ICON_SIZE} />}>
        {t("course-plans-section-status-ready")}
      </Badge>
    )
  }
  if (status === "Unfinished") {
    return (
      <Badge tone={TONE.WARNING} icon={<Clock size={ICON_SIZE} />}>
        {t("course-plans-section-status-unfinished")}
      </Badge>
    )
  }
  return <Badge tone={TONE.NEUTRAL}>{t("course-plans-section-status-not-marked")}</Badge>
}

/** Compact status icon for section navigation links; renders nothing when unmarked. */
export function SectionStatusDot(props: { stage: CourseDesignerStage; sectionKey: string }) {
  const { t } = useTranslation()
  const { findStatus } = useSectionStatuses()
  const status = findStatus(props.stage, props.sectionKey)?.status ?? null

  if (status === "Ready") {
    return (
      <span className={cx(dotStyles, readyDotStyles)}>
        <span aria-hidden>
          <CheckCircle size={ICON_SIZE} />
        </span>
        <VisuallyHidden>{t("course-plans-section-status-ready")}</VisuallyHidden>
      </span>
    )
  }
  if (status === "Unfinished") {
    return (
      <span className={cx(dotStyles, unfinishedDotStyles)}>
        <span aria-hidden>
          <Clock size={ICON_SIZE} />
        </span>
        <VisuallyHidden>{t("course-plans-section-status-unfinished")}</VisuallyHidden>
      </span>
    )
  }
  return null
}
