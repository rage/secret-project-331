"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { CourseEnrollmentInfo } from "@/generated/api/types.generated"
import { StatTile } from "@/shared-module/components"

import { awaitingReviewCount, completedModuleCount } from "../lib/completions"
import { TONE } from "../lib/displayConstants"

export interface UserStatBarProps {
  enrollments: CourseEnrollmentInfo[]
  /** Fragment id of the completion-review section the "awaiting review" tile links to. */
  reviewTargetId: string
}

const rowCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 1.5rem 0;
`

/** At-a-glance summary of the student's enrolment and review status. */
const UserStatBar: React.FC<UserStatBarProps> = ({ enrollments, reviewTargetId }) => {
  const { t } = useTranslation()

  const enrolled = enrollments.length
  const completions = enrollments.reduce((sum, e) => sum + completedModuleCount(e), 0)
  const awaitingReview = awaitingReviewCount(enrollments)

  return (
    <div className={rowCss}>
      <StatTile label={t("stat-enrolled-courses")} value={enrolled} />
      <StatTile label={t("stat-completions")} value={completions} />
      <StatTile
        label={t("stat-awaiting-review")}
        value={awaitingReview}
        tone={awaitingReview > 0 ? TONE.ALERT : TONE.NEUTRAL}
        {...(awaitingReview > 0 ? { href: `#${reviewTargetId}` } : {})}
      />
    </div>
  )
}

export default UserStatBar
