"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { CourseEnrollmentInfo } from "@/generated/api/types.generated"
import { includeIf } from "@/shared-module/common/utils/nullability"
import { StatTile, StatTileList } from "@/shared-module/components"

import { awaitingReviewCount, completedModuleCount } from "../lib/completions"

export interface UserStatBarProps {
  enrollments: CourseEnrollmentInfo[]
  /** Fragment id of the completion-review section the "awaiting review" tile links to. */
  reviewTargetId: string
}

/**
 * At-a-glance summary of the student's enrolment and review status.
 *
 * Nothing at all on a user with no enrolments: a row of zeros above two empty-state sentences
 * says less than the sentences do.
 */
const UserStatBar: React.FC<UserStatBarProps> = ({ enrollments, reviewTargetId }) => {
  const { t } = useTranslation()

  const enrolled = enrollments.length
  if (enrolled === 0) {
    return null
  }
  const completions = enrollments.reduce((sum, e) => sum + completedModuleCount(e), 0)
  const awaitingReview = awaitingReviewCount(enrollments)

  return (
    <StatTileList ariaLabel={t("stat-enrolled-courses")}>
      <StatTile label={t("stat-enrolled-courses")} value={enrolled} />
      <StatTile label={t("stat-completions")} value={completions} />
      <StatTile
        label={t("stat-awaiting-review")}
        value={awaitingReview}
        alertWhenNonZero
        {...includeIf(awaitingReview > 0, { href: `#${reviewTargetId}` })}
      />
    </StatTileList>
  )
}

export default UserStatBar
