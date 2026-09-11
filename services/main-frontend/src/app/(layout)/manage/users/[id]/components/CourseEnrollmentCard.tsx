"use client"

import { css } from "@emotion/css"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import CourseActivityTimeline from "@/components/CourseActivityTimeline"
import { MIDDLE_DOT, TIME_COMPACT, TONE } from "@/components/credit-registration/constants"
import { noteCss, rowCss, subsectionCss } from "@/components/credit-registration/styles"
import type { CourseEnrollmentInfo } from "@/generated/api/types.generated"
import ietfLanguageTagToHumanReadableName from "@/shared-module/common/utils/ietfLanguageTagToHumanReadableName"
import { courseUserStatusSummaryRoute } from "@/shared-module/common/utils/routes"
import { Badge, Disclosure, Link, MeterInline, RelativeTime } from "@/shared-module/components"

import { completedModuleCount } from "../lib/completions"
import {
  registrationsByModuleId,
  tallyRegistrations,
  type UserCreditRegistrations,
} from "../lib/creditRegistrations"
import { courseSpan } from "../lib/violinDensity"
import ModuleCompletionsTable from "./ModuleCompletionsTable"

export interface CourseEnrollmentCardProps {
  enrollment: CourseEnrollmentInfo
  userId: string
  registrations: UserCreditRegistrations
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
}

const titleCss = css`
  display: grid;
  gap: var(--space-1);
`

const titleRowCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
`

const courseNameCss = css`
  font-weight: 600;
  color: var(--color-gray-700);
`

const progressCss = css`
  max-width: 16rem;
`

// The per-course timeline holds an echarts canvas and a raw-data table, both wider than a phone; a
// grid item's `min-width: auto` would let either widen the page instead of scrolling.
const timelineFrameCss = css`
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
`

/**
 * One course a student is enrolled in.
 *
 * The collapsed row has to be enough to tell the courses the student worked in from the ones they
 * only signed up for, so progress, last activity and the state of the credits are all in the
 * trigger; the per-module detail and the activity chart only load once it is opened.
 */
const CourseEnrollmentCard: React.FC<CourseEnrollmentCardProps> = ({
  enrollment,
  userId,
  registrations,
  expanded,
  onExpandedChange,
}) => {
  const { t, i18n } = useTranslation()

  const totalModules = enrollment.course_modules.length
  const completedModules = completedModuleCount(enrollment)
  const reviewCount = enrollment.course_module_completions_needing_review
  const progressLabel = t("modules-completed-of-total", {
    completed: completedModules,
    total: totalModules,
  })
  const isComplete = totalModules > 0 && completedModules >= totalModules

  const registrationByModuleId = useMemo(
    () => registrationsByModuleId(registrations, enrollment.course_id),
    [registrations, enrollment.course_id],
  )
  const tally = registrationByModuleId ? tallyRegistrations(registrationByModuleId.values()) : null

  const { lastActivityMs, hasActivity } = courseSpan(enrollment)

  const title = (
    <span className={titleCss}>
      <span className={titleRowCss}>
        <span className={courseNameCss}>{enrollment.course.name}</span>
        {tally && tally.registered > 0 ? (
          <Badge tone={TONE.SUCCESS}>
            {t("credit-registration-count-registered", { count: tally.registered })}
          </Badge>
        ) : null}
        {tally && tally.failed > 0 ? (
          <Badge tone={TONE.DANGER}>
            {t("credit-registration-count-failed", { count: tally.failed })}
          </Badge>
        ) : null}
        {reviewCount > 0 ? (
          <Badge tone={TONE.WARNING}>{t("awaiting-review-count", { count: reviewCount })}</Badge>
        ) : null}
        {enrollment.is_current ? null : (
          <Badge tone={TONE.NEUTRAL}>{t("badge-not-current-version")}</Badge>
        )}
      </span>
      {!enrollment.is_current && (
        <span className={noteCss}>{t("not-current-version-explanation")}</span>
      )}
      <span className={noteCss}>
        {progressLabel}
        {MIDDLE_DOT}
        {hasActivity ? (
          <>
            {t("label-last-active")}{" "}
            <RelativeTime at={new Date(lastActivityMs).toISOString()} absoluteTime={TIME_COMPACT} />
          </>
        ) : (
          t("no-activity-yet")
        )}
      </span>
    </span>
  )

  return (
    <div data-testid="course-status-card">
      <Disclosure title={title} expanded={expanded} onExpandedChange={onExpandedChange}>
        <div className={subsectionCss}>
          <div className={rowCss}>
            <span className={noteCss}>{enrollment.course.slug}</span>
            <span className={noteCss}>{MIDDLE_DOT}</span>
            <span className={noteCss}>
              {ietfLanguageTagToHumanReadableName(enrollment.course.language_code, i18n.language)}
            </span>
          </div>
          {totalModules > 0 && (
            <MeterInline
              className={progressCss}
              label={progressLabel}
              valueText={t("modules-completed-fraction", {
                completed: completedModules,
                total: totalModules,
              })}
              value={completedModules}
              maxValue={totalModules}
              tone={isComplete ? TONE.SUCCESS : TONE.NEUTRAL}
            />
          )}
          <ModuleCompletionsTable
            enrollment={enrollment}
            registrationByModuleId={registrationByModuleId}
          />
          <div className={timelineFrameCss}>
            <CourseActivityTimeline courseId={enrollment.course_id} userId={userId} />
          </div>
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
