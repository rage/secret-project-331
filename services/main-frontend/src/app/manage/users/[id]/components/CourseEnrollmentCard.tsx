"use client"

import { css } from "@emotion/css"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import { completedModuleCount } from "../lib/completions"
import { TONE } from "../lib/displayConstants"

import CourseCompletionTimeline from "./CourseCompletionTimeline"
import ModuleCompletionsTable from "./ModuleCompletionsTable"

import type { CourseEnrollmentInfo } from "@/generated/api/types.generated"
import Button from "@/shared-module/common/components/Button"
import ietfLanguageTagToHumanReadableName from "@/shared-module/common/utils/ietfLanguageTagToHumanReadableName"
import { courseUserStatusSummaryRoute } from "@/shared-module/common/utils/routes"
import { Badge, Disclosure } from "@/shared-module/components"

export interface CourseEnrollmentCardProps {
  enrollment: CourseEnrollmentInfo
  userId: string
}

const cardCss = css`
  margin-bottom: 0.75rem;
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
  color: var(--color-gray-700, #1a2333);
`

const slugCss = css`
  color: var(--color-gray-400, #767b85);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
`

const metaCss = css`
  color: var(--color-gray-500, #535a66);
  font-size: 0.9rem;
`

const spacerCss = css`
  flex: 1 1 auto;
`

const linkRowCss = css`
  margin: 0.5rem 0 0 0.25rem;
`

/** One course a student is enrolled in: a scannable header row that expands to per-module detail. */
const CourseEnrollmentCard: React.FC<CourseEnrollmentCardProps> = ({ enrollment, userId }) => {
  const { t, i18n } = useTranslation()

  const totalModules = enrollment.course_modules.length
  const completedModules = completedModuleCount(enrollment)
  const reviewCount = enrollment.course_module_completions_needing_review

  const title = (
    <span className={summaryCss}>
      <span className={courseNameCss}>{enrollment.course.name}</span>
      <span className={slugCss}>{enrollment.course.slug}</span>
      <Badge tone={enrollment.is_current ? TONE.INFO : TONE.NEUTRAL}>
        {enrollment.is_current ? t("badge-current") : t("badge-past")}
      </Badge>
      <span className={metaCss}>
        {t("modules-completed-of-total", { completed: completedModules, total: totalModules })}
      </span>
      {reviewCount > 0 ? (
        <Badge tone={TONE.WARNING}>{t("awaiting-review-count", { count: reviewCount })}</Badge>
      ) : null}
      <span className={spacerCss} />
      <span className={metaCss}>
        {ietfLanguageTagToHumanReadableName(enrollment.course.language_code, i18n.language)}
      </span>
    </span>
  )

  return (
    <div className={cardCss} data-testid="course-status-card">
      <Disclosure title={title} aria-label={enrollment.course.name}>
        <ModuleCompletionsTable enrollment={enrollment} />
        <CourseCompletionTimeline enrollment={enrollment} />
      </Disclosure>
      <div className={linkRowCss}>
        <Link href={courseUserStatusSummaryRoute(enrollment.course_id, userId)}>
          <Button variant="tertiary" size="medium">
            {t("course-status-summary")}
          </Button>
        </Link>
      </div>
    </div>
  )
}

export default CourseEnrollmentCard
