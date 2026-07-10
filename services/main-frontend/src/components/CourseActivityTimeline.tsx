"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import type { EChartsOption } from "echarts"
import React from "react"
import { useTranslation } from "react-i18next"

import Echarts from "@/app/manage/courses/[id]/stats/Echarts"
import {
  getUserCourseEnrollmentsOptions,
  getUserCourseSubmissionTimesOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import Spinner from "@/shared-module/common/components/Spinner"
import { dateToString } from "@/shared-module/common/utils/time"
import { Disclosure } from "@/shared-module/components"
import { computeModuleRows, formatDuration } from "@/utils/moduleTimeline"
import {
  colorAt,
  ECHARTS,
  NEUTRAL_MARK_COLOR,
  REVIEW_ACCENT,
  SERIES_COLORS,
  SPLIT_AREA_COLORS,
  TIME_AXIS_LABEL,
  timeAxisBounds,
} from "@/utils/timelineChart"

export interface CourseActivityTimelineProps {
  courseId: string
  userId: string
}

const LINE_BREAK = "<br />"
const OTHER_KEY = "__other__"
const EMPTY_CELL = "—"
const STAR = "★"
const SUBMISSION_CAP = 5000
const LANE = "activity"
const MARK_BORDER = "#ffffff"
const SUBMISSION_SIZE = 9
const COMPLETION_SIZE = 16

const tableCss = css`
  width: 100%;
  border-collapse: collapse;
  font-size: 15px;

  th,
  td {
    text-align: left;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid var(--color-clear-300, #e2e4e6);
  }

  th {
    color: var(--color-gray-500, #535a66);
    font-weight: 600;
  }

  td {
    color: var(--color-gray-700, #1a2333);
    font-variant-numeric: tabular-nums;
  }
`

const noteCss = css`
  margin-top: 0.5rem;
  color: var(--color-gray-500, #535a66);
  font-size: 0.85rem;
`

const legendCss = css`
  margin: 0.25rem 0 0;
  color: var(--color-gray-500, #535a66);
  font-size: 0.85rem;
`

/**
 * A user's activity within one course on a single time lane: every exercise submission as a
 * module-colored dot (filled = first attempt on that exercise, hollow ring = a retry) and each module
 * completion as a larger diamond milestone on the same line. Self-fetching (course enrollments +
 * submission times) so it drops onto any page with just `courseId`/`userId`; the enrollments query is
 * shared with the user-details page cache.
 */
const CourseActivityTimeline: React.FC<CourseActivityTimelineProps> = ({ courseId, userId }) => {
  const { t } = useTranslation()

  const enrollmentsQuery = useQuery(getUserCourseEnrollmentsOptions({ path: { user_id: userId } }))
  const submissionsQuery = useQuery(
    getUserCourseSubmissionTimesOptions({ path: { user_id: userId, course_id: courseId } }),
  )

  if (enrollmentsQuery.isPending || submissionsQuery.isPending) {
    return <Spinner variant="medium" />
  }

  const enrollment = enrollmentsQuery.data?.course_enrollments.find((e) => e.course_id === courseId)
  if (!enrollment) {
    return null
  }

  const submissions = submissionsQuery.data ?? []
  const completions = enrollment.course_module_completions
  const enrolledMs = new Date(enrollment.first_enrolled_at).getTime()

  const modules = [...enrollment.course_modules].sort((a, b) => a.order_number - b.order_number)
  const colorByModuleId = new Map(modules.map((m, i) => [m.id, colorAt(SERIES_COLORS, i)]))
  const labelByModuleId = new Map(modules.map((m) => [m.id, m.name ?? t("default-module")]))
  const bucketKey = (moduleId: string | null | undefined): string =>
    moduleId && colorByModuleId.has(moduleId) ? moduleId : OTHER_KEY
  const bucketColor = (key: string): string => colorByModuleId.get(key) ?? NEUTRAL_MARK_COLOR
  const bucketLabel = (key: string): string => labelByModuleId.get(key) ?? t("label-other-module")

  // Per-module rows (start/completion/durations) for the table and completion tooltips.
  const moduleRows = computeModuleRows(enrollment)
  const rowByModuleId = new Map(moduleRows.map((r) => [r.moduleId, r]))

  // Attempt ordinal per exercise (submissions arrive ordered by created_at); attempt 1 is filled, later
  // attempts (retries) are hollow rings.
  const attemptCounters = new Map<string, number>()
  const enrichedSubmissions = submissions.map((s) => {
    const attempt = (attemptCounters.get(s.exercise_id) ?? 0) + 1
    attemptCounters.set(s.exercise_id, attempt)
    return { ...s, attempt, ms: new Date(s.created_at).getTime() }
  })

  // Only surface modules that actually have activity, so the legend isn't cluttered with empty modules.
  const hasData = (key: string): boolean =>
    enrichedSubmissions.some((s) => bucketKey(s.course_module_id) === key) ||
    completions.some((c) => bucketKey(c.course_module_id) === key)
  const seriesKeys = [...modules.map((m) => m.id), OTHER_KEY].filter(hasData)

  const moduleSeries = seriesKeys.map((key) => {
    const submissionData = enrichedSubmissions
      .filter((s) => bucketKey(s.course_module_id) === key)
      .map((s) => {
        const first = s.attempt === 1
        return {
          value: [s.ms, LANE],
          symbol: first ? ECHARTS.SYMBOL_CIRCLE : ECHARTS.SYMBOL_EMPTY_CIRCLE,
          symbolSize: SUBMISSION_SIZE,
          itemStyle: first ? { borderColor: MARK_BORDER, borderWidth: 1 } : { borderWidth: 1.5 },
          _tip: [
            bucketLabel(key),
            t("tooltip-exercise", { id: s.exercise_id.slice(0, 8) }),
            first ? t("label-first-attempt") : t("attempt-number", { n: s.attempt }),
            dateToString(new Date(s.ms)),
          ].join(LINE_BREAK),
        }
      })
    const completionData = completions
      .filter((c) => bucketKey(c.course_module_id) === key)
      .map((c) => {
        const when = new Date(c.completion_date)
        const row = c.course_module_id ? rowByModuleId.get(c.course_module_id) : undefined
        const tip = [
          bucketLabel(key),
          c.needs_to_be_reviewed ? t("label-review") : t("label-completed"),
          dateToString(when),
        ]
        if (row?.moduleSeconds != null) {
          tip.push(t("tooltip-time-in-module", { duration: formatDuration(row.moduleSeconds, t) }))
        }
        if (row?.sinceEnrollSeconds != null) {
          tip.push(
            t("tooltip-since-enrolled", { duration: formatDuration(row.sinceEnrollSeconds, t) }),
          )
        }
        return {
          value: [when.getTime(), LANE],
          symbol: ECHARTS.SYMBOL_DIAMOND,
          symbolSize: COMPLETION_SIZE,
          itemStyle: c.needs_to_be_reviewed
            ? { borderColor: REVIEW_ACCENT, borderWidth: 2 }
            : { borderColor: MARK_BORDER, borderWidth: 1 },
          _tip: tip.join(LINE_BREAK),
        }
      })
    return {
      name: bucketLabel(key),
      type: "scatter" as const,
      itemStyle: { color: bucketColor(key) },
      // Submissions first so completion diamonds paint on top within a module.
      data: [...submissionData, ...completionData],
    }
  })

  const enrollmentSeries = {
    type: "scatter" as const,
    data: [],
    markLine: {
      silent: true,
      symbol: ECHARTS.SYMBOL_NONE,
      label: {
        position: ECHARTS.LABEL_END,
        formatter: t("label-first-enrolled"),
        color: NEUTRAL_MARK_COLOR,
      },
      lineStyle: { type: "dashed" as const, color: NEUTRAL_MARK_COLOR },
      data: [{ xAxis: enrolledMs }],
    },
  }

  const { min, max } = timeAxisBounds([
    enrolledMs,
    ...completions.map((c) => new Date(c.completion_date).getTime()),
    ...enrichedSubmissions.map((s) => s.ms),
  ])

  const moduleLabels = seriesKeys.map((key) => bucketLabel(key))

  const options: EChartsOption = {
    tooltip: {
      trigger: ECHARTS.TRIGGER_ITEM,
      formatter: (params) => (params as unknown as { data?: { _tip?: string } }).data?._tip ?? "",
    },
    legend: { type: "scroll", top: 4, icon: ECHARTS.SYMBOL_CIRCLE, data: moduleLabels },
    grid: { left: 12, right: 24, top: 40, bottom: 56, containLabel: true },
    xAxis: {
      type: "time",
      min,
      max,
      axisLabel: { formatter: TIME_AXIS_LABEL, hideOverlap: true },
      splitArea: { show: true, areaStyle: { color: SPLIT_AREA_COLORS } },
    },
    yAxis: {
      type: "category",
      data: [LANE],
      axisLabel: { show: false },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    dataZoom: [
      {
        type: "slider",
        filterMode: ECHARTS.FILTER_WEAK,
        showDataShadow: false,
        bottom: 8,
        height: 18,
      },
      { type: "inside", filterMode: ECHARTS.FILTER_WEAK },
    ],
    aria: { enabled: true },
    series: [...moduleSeries, enrollmentSeries],
  }

  const hasChart = completions.length > 0 || enrichedSubmissions.length > 0

  return (
    <div>
      {hasChart ? (
        <>
          <Echarts options={options} height={180} />
          <p className={legendCss}>{t("submission-legend")}</p>
          {submissions.length >= SUBMISSION_CAP ? (
            <p className={noteCss}>{t("submissions-capped", { count: SUBMISSION_CAP })}</p>
          ) : null}
        </>
      ) : null}
      <Disclosure title={t("show-underlying-data")}>
        <table className={tableCss}>
          <caption
            className={css`
              text-align: left;
              color: var(--color-gray-500, #535a66);
              padding: 0.25rem 0;
            `}
          >
            {t("completion-timeline-caption")}
          </caption>
          <thead>
            <tr>
              <th>{t("label-module")}</th>
              <th>{t("label-started")}</th>
              <th>{t("label-completed")}</th>
              <th>{t("label-time-in-module")}</th>
              <th>{t("label-since-enrolled")}</th>
            </tr>
          </thead>
          <tbody>
            {moduleRows.map((row) => (
              <tr key={row.moduleId}>
                <td>{row.name ?? t("default-module")}</td>
                <td>
                  {row.startedAt ? (
                    <>
                      {row.isBase ? `${STAR} ` : ""}
                      {dateToString(row.startedAt)}
                    </>
                  ) : (
                    EMPTY_CELL
                  )}
                </td>
                <td>
                  {row.completedAt
                    ? row.needsReview
                      ? t("completed-review", { date: dateToString(row.completedAt) })
                      : dateToString(row.completedAt)
                    : EMPTY_CELL}
                </td>
                <td>
                  {row.moduleSeconds != null
                    ? formatDuration(row.moduleSeconds, t)
                    : row.startedAt
                      ? t("in-progress")
                      : EMPTY_CELL}
                </td>
                <td>
                  {row.sinceEnrollSeconds != null
                    ? formatDuration(row.sinceEnrollSeconds, t)
                    : EMPTY_CELL}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Disclosure>
    </div>
  )
}

export default CourseActivityTimeline
