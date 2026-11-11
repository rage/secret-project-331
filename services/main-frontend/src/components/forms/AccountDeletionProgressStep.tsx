"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import type { TFunction } from "i18next"
import React, { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { getMyProgressByPlatformOptions } from "@/generated/api/@tanstack/react-query.generated"
import type {
  CoursesMoocFiCourseProgress,
  ExternalPlatformStatus,
  MoocFiCourseProgress,
  ProgressByPlatform,
  TmcMoocFiCourseProgress,
} from "@/generated/api/types.generated"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import { Checkbox, ErrorNotice, Infobox, LoadingRegion } from "@/shared-module/components"

const COURSES_MOOC_FI = "courses.mooc.fi"
const MOOC_FI = "mooc.fi"
const TMC_MOOC_FI = "tmc.mooc.fi"
const WARNING_TONE = "warning" as const

interface CourseSummary {
  key: string
  name: string
  summary: string
}

interface PlatformCourses {
  platform: string
  courses: CourseSummary[]
}

interface AccountDeletionProgressStepProps {
  onAcknowledgedChange: (acknowledged: boolean) => void
}

/** Lists what the user loses on every platform and asks them to acknowledge it. */
const AccountDeletionProgressStep: React.FC<AccountDeletionProgressStepProps> = ({
  onAcknowledgedChange,
}) => {
  const { t } = useTranslation()
  const progressQuery = useQuery(getMyProgressByPlatformOptions())
  // oxlint-disable-next-line i18next/no-literal-string
  const { control, watch } = useForm<{ acknowledged: boolean }>({
    defaultValues: { acknowledged: false },
  })
  const acknowledged = watch("acknowledged")

  useEffect(() => {
    onAcknowledgedChange(acknowledged)
  }, [acknowledged, onAcknowledgedChange])

  if (progressQuery.isPending) {
    return <LoadingRegion label={t("delete-account-checking-progress")} showLabel />
  }

  const platforms = progressQuery.data ? groupByPlatform(progressQuery.data, t) : []
  const courseCount = platforms.reduce((sum, platform) => sum + platform.courses.length, 0)
  const uncheckedPlatforms = progressQuery.data
    ? unavailablePlatforms(progressQuery.data)
    : [COURSES_MOOC_FI, MOOC_FI, TMC_MOOC_FI]

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        gap: 1rem;
      `}
    >
      {progressQuery.isError && <ErrorNotice error={progressQuery.error} />}
      {platforms.length > 0 && <p>{t("delete-account-progress-intro")}</p>}
      {platforms.map(({ platform, courses }) => (
        <section key={platform} data-testid={`delete-account-progress-${platform}`}>
          <h3
            className={css`
              font-size: 0.9375rem;
              font-weight: ${fontWeights.semibold};
              color: ${baseTheme.colors.gray[700]};
              margin: 0 0 0.375rem 0;
            `}
          >
            {platform}
          </h3>
          <ul
            className={css`
              margin: 0;
              padding-left: 1.25rem;
            `}
          >
            {courses.map((course) => (
              <li key={course.key}>
                <span
                  className={css`
                    font-weight: ${fontWeights.medium};
                  `}
                >
                  {course.name}
                </span>
                {course.summary && (
                  <span
                    className={css`
                      color: ${baseTheme.colors.gray[600]};
                    `}
                  >
                    {` — ${course.summary}`}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {uncheckedPlatforms.map((platform) => (
        <Infobox key={platform} tone={WARNING_TONE}>
          {t("delete-account-progress-unavailable", { platform })}
        </Infobox>
      ))}
      <Checkbox
        name="acknowledged"
        control={control}
        rules={{ required: true }}
        data-testid="delete-account-acknowledge-progress-loss"
        label={
          courseCount > 0
            ? t("delete-account-acknowledge-progress-loss", { count: courseCount })
            : t("delete-account-acknowledge-permanent")
        }
      />
    </div>
  )
}

function isUnavailable(status: ExternalPlatformStatus): boolean {
  return status === "unavailable"
}

function unavailablePlatforms(progress: ProgressByPlatform): string[] {
  return [
    ...(isUnavailable(progress.mooc_fi_status) ? [MOOC_FI] : []),
    ...(isUnavailable(progress.tmc_mooc_fi_status) ? [TMC_MOOC_FI] : []),
  ]
}

function groupByPlatform(progress: ProgressByPlatform, t: TFunction): PlatformCourses[] {
  const platforms: PlatformCourses[] = [
    {
      platform: COURSES_MOOC_FI,
      courses: progress.courses_mooc_fi.map((course) => ({
        key: course.course_id,
        name: course.name,
        summary: coursesMoocFiSummary(course, t),
      })),
    },
    {
      platform: MOOC_FI,
      courses: progress.mooc_fi.map((course) => ({
        key: course.course_id,
        name: course.name,
        summary: moocFiSummary(course, t),
      })),
    },
    {
      platform: TMC_MOOC_FI,
      courses: progress.tmc_mooc_fi.map((course, index) => ({
        key: `${index}-${course.name}`,
        name: course.name,
        summary: tmcSummary(course, t),
      })),
    },
  ]
  return platforms.filter((platform) => platform.courses.length > 0)
}

const SUMMARY_SEPARATOR = " · "

function round(points: number): number {
  return Math.round(points * 100) / 100
}

function pointsSummary(points: number, maxPoints: number | null | undefined, t: TFunction) {
  return maxPoints
    ? t("delete-account-progress-points-of-max", { points: round(points), max: round(maxPoints) })
    : t("delete-account-progress-points", { count: round(points) })
}

function coursesMoocFiSummary(course: CoursesMoocFiCourseProgress, t: TFunction): string {
  return [
    course.total_modules > 1 &&
      t("delete-account-progress-modules", {
        completed: course.completed_modules,
        total: course.total_modules,
      }),
    course.total_modules === 1 &&
      course.completed_modules === 1 &&
      t("delete-account-progress-completed"),
    pointsSummary(course.points, course.max_points, t),
  ]
    .filter(Boolean)
    .join(SUMMARY_SEPARATOR)
}

function moocFiSummary(course: MoocFiCourseProgress, t: TFunction): string {
  const tmcPoints = course.tmc_mooc_fi_courses.reduce((sum, c) => sum + c.awarded_points, 0)
  const tmcSubmissions = course.tmc_mooc_fi_courses.reduce((sum, c) => sum + c.submissions, 0)
  return [
    course.completed && t("delete-account-progress-completed"),
    course.points !== null &&
      course.points !== undefined &&
      pointsSummary(course.points, course.max_points, t),
    course.tmc_mooc_fi_courses.length > 0 &&
      t("delete-account-progress-on-platform", {
        platform: TMC_MOOC_FI,
        summary: tmcSummaryText(tmcPoints, tmcSubmissions, t),
      }),
  ]
    .filter(Boolean)
    .join(SUMMARY_SEPARATOR)
}

function tmcSummary(course: TmcMoocFiCourseProgress, t: TFunction): string {
  return tmcSummaryText(course.awarded_points, course.submissions, t)
}

function tmcSummaryText(points: number, submissions: number, t: TFunction): string {
  return [
    t("delete-account-progress-points", { count: points }),
    t("delete-account-progress-submissions", { count: submissions }),
  ].join(", ")
}

export default AccountDeletionProgressStep
