"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import { MIDDLE_DOT } from "../lib/displayConstants"
import { ratioPercent, toHours } from "../lib/durations"
import { sectionHeadingCss } from "../lib/sectionHeading"

import { getUserSuspectedCheatersOptions } from "@/generated/api/@tanstack/react-query.generated"
import type {
  CourseEnrollmentInfo,
  SuspectedCheaterStatus,
  UserSuspectedCheaterInfo,
} from "@/generated/api/types.generated"
import { manageCourseOtherCheatersSuspectedRoute } from "@/shared-module/common/utils/routes"
import { dateToString } from "@/shared-module/common/utils/time"
import { Badge, Meter, QueryResult } from "@/shared-module/components"

export interface CompletionReviewSectionProps {
  userId: string
  enrollments: CourseEnrollmentInfo[]
  /** Fragment id used as the section anchor (matches the banner link). */
  id: string
}

const rowCss = css`
  display: grid;
  grid-template-columns: minmax(12rem, 1fr) minmax(14rem, 20rem);
  gap: 0.35rem 1.5rem;
  align-items: center;
  padding: 0.85rem 0;
  border-bottom: 1px solid var(--color-clear-300, #e2e4e6);
`

const courseCss = css`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
`

const courseHeadCss = css`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
`

const courseLinkCss = css`
  font-weight: 600;
  color: var(--color-blue-600, #2563eb);
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`

const meterWrapCss = css`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
`

const meterValueCss = css`
  align-self: flex-end;
  color: var(--color-gray-700, #1a2333);
  font-weight: 600;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
`

const sectionCss = css`
  margin: 3rem 0;
`

const explanationCss = css`
  color: var(--color-gray-500, #535a66);
  font-size: 0.85rem;
  margin: 0 0 0.75rem;
`

const metaCss = css`
  color: var(--color-gray-500, #535a66);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
`

// Tone shared by the status Badge and the duration Meter (values valid for both tone unions).
const STATUS_TONE: Record<SuspectedCheaterStatus, "neutral" | "warning" | "danger"> = {
  Flagged: "warning",
  ConfirmedCheating: "danger",
  Dismissed: "neutral",
}

const useStatusLabel = () => {
  const { t } = useTranslation()
  return (status: SuspectedCheaterStatus): string => {
    switch (status) {
      case "Flagged":
        return t("status-flagged")
      case "ConfirmedCheating":
        return t("status-confirmed-cheating")
      case "Dismissed":
        return t("status-dismissed")
    }
  }
}

/**
 * Read-only cross-course view of the student's suspected-cheating records: per course a status badge
 * and a duration-vs-threshold meter. Teachers confirm/dismiss on the per-course cheaters page, linked
 * from each row.
 */
const CompletionReviewSection: React.FC<CompletionReviewSectionProps> = ({
  userId,
  enrollments,
  id,
}) => {
  const { t } = useTranslation()
  const statusLabel = useStatusLabel()
  const query = useQuery({
    ...getUserSuspectedCheatersOptions({ path: { user_id: userId } }),
  })

  const courseName = (courseId: string): string =>
    enrollments.find((e) => e.course_id === courseId)?.course.name ?? courseId

  return (
    <QueryResult query={query} treatEmptyAsData>
      {(records: UserSuspectedCheaterInfo[]) => {
        if (records.length === 0) {
          return null
        }
        return (
          <section id={id} className={sectionCss}>
            <h2 className={sectionHeadingCss}>{t("completion-review")}</h2>
            <p className={explanationCss}>{t("completion-review-explanation")}</p>
            {records.map((record) => {
              const durationSeconds = record.total_duration_seconds ?? 0
              const percent = ratioPercent(durationSeconds, record.threshold_seconds)
              const valueLabel = t("duration-of-threshold", {
                hours: toHours(durationSeconds),
                threshold: toHours(record.threshold_seconds),
                percent,
              })
              return (
                <div className={rowCss} key={record.course_id}>
                  <div className={courseCss}>
                    <div className={courseHeadCss}>
                      <Link
                        className={courseLinkCss}
                        href={manageCourseOtherCheatersSuspectedRoute(record.course_id)}
                      >
                        {courseName(record.course_id)}
                      </Link>
                      <Badge tone={STATUS_TONE[record.status]}>{statusLabel(record.status)}</Badge>
                    </div>
                    <span className={metaCss}>
                      {t("points-value", { points: record.total_points })}
                      {MIDDLE_DOT}
                      {t("first-flagged-on", {
                        date: dateToString(new Date(record.first_flagged_at)),
                      })}
                    </span>
                  </div>
                  <div className={meterWrapCss}>
                    <span className={meterValueCss}>{valueLabel}</span>
                    <Meter
                      label={t("duration-vs-threshold-label", {
                        course: courseName(record.course_id),
                      })}
                      value={durationSeconds}
                      maxValue={record.threshold_seconds}
                      threshold={record.threshold_seconds}
                      tone={STATUS_TONE[record.status]}
                      valueLabel={valueLabel}
                      showLabel={false}
                    />
                  </div>
                </div>
              )
            })}
          </section>
        )
      }}
    </QueryResult>
  )
}

export default CompletionReviewSection
