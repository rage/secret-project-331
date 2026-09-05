"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import CourseActivityTimeline from "@/components/CourseActivityTimeline"
import { MIDDLE_DOT, TONE } from "@/components/credit-registration/constants"
import { noteCss, rowCss, subsectionCss } from "@/components/credit-registration/styles"
import type { CourseEnrollmentInfo } from "@/generated/api/types.generated"
import ietfLanguageTagToHumanReadableName from "@/shared-module/common/utils/ietfLanguageTagToHumanReadableName"
import { courseUserStatusSummaryRoute } from "@/shared-module/common/utils/routes"
import { Badge, Disclosure, Link, Meter } from "@/shared-module/components"

import { completedModuleCount } from "../lib/completions"
import ModuleCompletionsTable from "./ModuleCompletionsTable"

export interface CourseEnrollmentCardProps {
  enrollment: CourseEnrollmentInfo
  userId: string
}

// A superseded enrollment (the student's active version is a different one) is dimmed; the badge in the
// header row names the state explicitly.
const notCurrentCss = css`
  opacity: 0.7;
`

const titleCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2) var(--space-3);
`

const courseNameCss = css`
  font-weight: 600;
  color: var(--color-gray-700);
`

const progressCss = css`
  max-width: 16rem;
`

/** One course a student is enrolled in: a scannable header row that expands to per-module detail. */
const CourseEnrollmentCard: React.FC<CourseEnrollmentCardProps> = ({ enrollment, userId }) => {
  const { t, i18n } = useTranslation()

  const totalModules = enrollment.course_modules.length
  const completedModules = completedModuleCount(enrollment)
  const reviewCount = enrollment.course_module_completions_needing_review
  const progressLabel = t("modules-completed-of-total", {
    completed: completedModules,
    total: totalModules,
  })
  const isComplete = totalModules > 0 && completedModules >= totalModules

  // Course name and, when there is one, the single fact that changes how the row is read. Progress,
  // slug and language sit inside, so the trigger stays a heading rather than a toolbar.
  const title = (
    <span className={titleCss}>
      <span className={courseNameCss}>{enrollment.course.name}</span>
      {reviewCount > 0 ? (
        <Badge tone={TONE.WARNING}>{t("awaiting-review-count", { count: reviewCount })}</Badge>
      ) : null}
      {enrollment.is_current ? null : (
        <Badge tone={TONE.NEUTRAL}>{t("badge-not-current-version")}</Badge>
      )}
    </span>
  )

  return (
    <div
      className={enrollment.is_current ? undefined : notCurrentCss}
      data-testid="course-status-card"
    >
      <Disclosure title={title}>
        <div className={subsectionCss}>
          <div className={rowCss}>
            <span className={noteCss}>{enrollment.course.slug}</span>
            <span className={noteCss}>{MIDDLE_DOT}</span>
            <span className={noteCss}>
              {ietfLanguageTagToHumanReadableName(enrollment.course.language_code, i18n.language)}
            </span>
          </div>
          {totalModules > 0 && (
            <Meter
              className={progressCss}
              label={progressLabel}
              valueLabel={progressLabel}
              value={completedModules}
              maxValue={totalModules}
              showLabel
              tone={isComplete ? TONE.SUCCESS : TONE.NEUTRAL}
            />
          )}
          <ModuleCompletionsTable enrollment={enrollment} />
          <CourseActivityTimeline courseId={enrollment.course_id} userId={userId} />
          <div>
            <Link href={courseUserStatusSummaryRoute(enrollment.course_id, userId)}>
              {t("course-status-summary")}
            </Link>
          </div>
        </div>
      </Disclosure>
    </div>
  )
}

export default CourseEnrollmentCard
