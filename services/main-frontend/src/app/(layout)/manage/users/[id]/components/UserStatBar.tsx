"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { CourseEnrollmentInfo } from "@/generated/api/types.generated"
import { StatTile, StatTileList } from "@/shared-module/components"

import { completedModuleCount } from "../lib/completions"
import { tallyRegistrations, type UserCreditRegistrations } from "../lib/creditRegistrations"

export interface UserStatBarProps {
  enrollments: CourseEnrollmentInfo[]
  registrations: UserCreditRegistrations
}

/**
 * At-a-glance summary of what the student has enrolled in, passed, and had registered in Sisu.
 *
 * Nothing at all on a user with no enrolments: a row of zeros above two empty-state sentences
 * says less than the sentences do. Completions awaiting cheating review are deliberately absent —
 * `CompletionReviewBanner` is the one place that count is raised.
 */
const UserStatBar: React.FC<UserStatBarProps> = ({ enrollments, registrations }) => {
  const { t } = useTranslation()

  const enrolled = enrollments.length
  if (enrolled === 0) {
    return null
  }
  const modulesPassed = enrollments.reduce((sum, e) => sum + completedModuleCount(e), 0)
  const credits = tallyRegistrations([...registrations.byCourseId.values()].flat())

  return (
    <StatTileList ariaLabel={t("stat-list-student-summary")}>
      <StatTile label={t("stat-enrolled-courses")} value={enrolled} />
      <StatTile label={t("stat-modules-passed")} value={modulesPassed} />
      {credits.total > 0 ? (
        <StatTile
          label={t("stat-credits-registered")}
          value={t("value-of-total", { value: credits.registered, total: credits.total })}
        />
      ) : null}
    </StatTileList>
  )
}

export default UserStatBar
