"use client"

import { css, cx } from "@emotion/css"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import CourseActivityTimeline from "@/components/CourseActivityTimeline"
import type { CourseEnrollmentInfo } from "@/generated/api/types.generated"
import { baseTheme } from "@/shared-module/common/styles"
import ietfLanguageTagToHumanReadableName from "@/shared-module/common/utils/ietfLanguageTagToHumanReadableName"
import { courseUserStatusSummaryRoute } from "@/shared-module/common/utils/routes"
import { Badge, Disclosure } from "@/shared-module/components"

import { completedModuleCount } from "../lib/completions"
import { TONE } from "../lib/displayConstants"
import ModuleCompletionsTable from "./ModuleCompletionsTable"

export interface CourseEnrollmentCardProps {
  enrollment: CourseEnrollmentInfo
  userId: string
}

const cardCss = css`
  margin-bottom: 0.75rem;
`

// A superseded enrollment (the student's active version is a different one) is dimmed; the badge in the
// header row names the state explicitly.
const notCurrentCss = css`
  opacity: 0.7;
`

const summaryCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem 0.75rem;
`

const courseNameCss = css`
  font-weight: 600;
  font-size: 1.05rem;
  color: ${baseTheme.colors.gray[700]};
`

const slugCss = css`
  color: ${baseTheme.colors.gray[400]};
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
`

const metaCss = css`
  color: ${baseTheme.colors.gray[500]};
  font-size: 0.9rem;
`

const moduleProgressCss = css`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
`

// Presentational (aria-hidden) progress bar; the adjacent "X of Y modules" text carries the value.
const progressTrackCss = css`
  display: inline-block;
  width: 56px;
  height: 6px;
  border-radius: 999px;
  background: ${baseTheme.colors.gray[200]};
  overflow: hidden;
`

const progressFillCss = css`
  display: block;
  height: 100%;
  border-radius: 999px;
  background: ${baseTheme.colors.gray[400]};

  &[data-complete="true"] {
    background: ${baseTheme.colors.green[600]};
  }
`

const spacerCss = css`
  flex: 1 1 auto;
`

const linkRowCss = css`
  margin: 0.75rem 0 0.25rem;
`

const statusLinkCss = css`
  font-size: 0.9rem;
  color: ${baseTheme.colors.blue[600]};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
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
  const progressPct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0

  const title = (
    <span className={summaryCss}>
      <span className={courseNameCss}>{enrollment.course.name}</span>
      <span className={slugCss}>{enrollment.course.slug}</span>
      <span className={moduleProgressCss}>
        <span className={progressTrackCss} aria-hidden="true">
          <span
            className={cx(
              progressFillCss,
              css`
                width: ${progressPct}%;
              `,
            )}
            data-complete={isComplete}
          />
        </span>
        <span className={metaCss}>{progressLabel}</span>
      </span>
      {reviewCount > 0 ? (
        <Badge tone={TONE.WARNING}>{t("awaiting-review-count", { count: reviewCount })}</Badge>
      ) : null}
      {enrollment.is_current ? null : (
        <Badge tone={TONE.NEUTRAL}>{t("badge-not-current-version")}</Badge>
      )}
      <span className={spacerCss} />
      <span className={metaCss}>
        {ietfLanguageTagToHumanReadableName(enrollment.course.language_code, i18n.language)}
      </span>
    </span>
  )

  return (
    <div
      className={cx(cardCss, enrollment.is_current ? undefined : notCurrentCss)}
      data-testid="course-status-card"
    >
      <Disclosure title={title}>
        <ModuleCompletionsTable enrollment={enrollment} />
        <CourseActivityTimeline courseId={enrollment.course_id} userId={userId} />
        <div className={linkRowCss}>
          <Link
            className={statusLinkCss}
            href={courseUserStatusSummaryRoute(enrollment.course_id, userId)}
          >
            {t("course-status-summary")}
          </Link>
        </div>
      </Disclosure>
    </div>
  )
}

export default CourseEnrollmentCard
