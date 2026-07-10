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
import {
  attemptSymbol,
  colorAt,
  ECHARTS,
  MODULE_COLORS,
  NEEDS_REVIEW_COLOR,
  NEUTRAL_MARK_COLOR,
  timeAxisBounds,
} from "@/utils/timelineChart"

export interface CourseActivityTimelineProps {
  courseId: string
  userId: string
}

const LINE_BREAK = "<br />"
const OTHER_KEY = "__other__"
const EMPTY_CELL = "—"
const SUBMISSION_CAP = 5000

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

const symbolKeyCss = css`
  margin: 0.25rem 0 0;
  color: var(--color-gray-500, #535a66);
  font-size: 0.85rem;
`

/**
 * A user's activity within one course: module completions and every exercise submission on a shared
 * time axis. Submissions are colored by module and their symbol encodes the attempt ordinal per
 * exercise (1st, 2nd, …). Self-fetching (course enrollments + submission times) so it drops onto any
 * page with just `courseId`/`userId`; the enrollments query is shared with the user-details page cache.
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
  const colorByModuleId = new Map(modules.map((m, i) => [m.id, colorAt(MODULE_COLORS, i)]))
  const labelByModuleId = new Map(modules.map((m) => [m.id, m.name ?? t("default-module")]))
  const bucketKey = (moduleId: string | null | undefined): string =>
    moduleId && colorByModuleId.has(moduleId) ? moduleId : OTHER_KEY
  const bucketColor = (key: string): string => colorByModuleId.get(key) ?? NEUTRAL_MARK_COLOR
  const bucketLabel = (key: string): string => labelByModuleId.get(key) ?? t("label-other-module")

  // Attempt ordinal per exercise (submissions arrive ordered by created_at).
  const attemptCounters = new Map<string, number>()
  const enrichedSubmissions = submissions.map((s) => {
    const attempt = (attemptCounters.get(s.exercise_id) ?? 0) + 1
    attemptCounters.set(s.exercise_id, attempt)
    return { ...s, attempt, ms: new Date(s.created_at).getTime() }
  })

  const laneCompletions = t("label-completions-lane")
  const laneSubmissions = t("label-submissions-lane")

  // Only surface modules that actually have activity, so the legend isn't cluttered with empty modules.
  const hasData = (key: string): boolean =>
    enrichedSubmissions.some((s) => bucketKey(s.course_module_id) === key) ||
    completions.some((c) => bucketKey(c.course_module_id) === key)
  const seriesKeys = [...modules.map((m) => m.id), OTHER_KEY].filter(hasData)

  const moduleSeries = seriesKeys.map((key) => {
    const submissionData = enrichedSubmissions
      .filter((s) => bucketKey(s.course_module_id) === key)
      .map((s) => ({
        value: [s.ms, laneSubmissions],
        symbol: attemptSymbol(s.attempt - 1),
        symbolSize: 8,
        _tip: [
          bucketLabel(key),
          t("attempt-number", { n: s.attempt }),
          t("tooltip-exercise", { id: s.exercise_id.slice(0, 8) }),
          dateToString(new Date(s.ms)),
        ].join(LINE_BREAK),
      }))
    const completionData = completions
      .filter((c) => bucketKey(c.course_module_id) === key)
      .map((c) => {
        const when = new Date(c.completion_date)
        return {
          value: [when.getTime(), laneCompletions],
          symbol: ECHARTS.SYMBOL_PIN,
          symbolSize: 18,
          itemStyle: c.needs_to_be_reviewed
            ? { borderColor: NEEDS_REVIEW_COLOR, borderWidth: 2 }
            : {},
          _tip: [
            bucketLabel(key),
            c.needs_to_be_reviewed ? t("badge-hidden-from-student") : t("label-completed"),
            dateToString(when),
          ].join(LINE_BREAK),
        }
      })
    return {
      name: bucketLabel(key),
      type: "scatter" as const,
      itemStyle: { color: bucketColor(key) },
      data: [...submissionData, ...completionData],
    }
  })

  const enrollmentSeries = {
    type: "scatter" as const,
    data: [],
    markLine: {
      silent: true,
      symbol: ECHARTS.SYMBOL_NONE,
      label: { formatter: t("label-first-enrolled") },
      lineStyle: { type: "dashed" as const, color: NEUTRAL_MARK_COLOR },
      data: [{ xAxis: enrolledMs }],
    },
  }

  const { min, max } = timeAxisBounds([
    enrolledMs,
    ...completions.map((c) => new Date(c.completion_date).getTime()),
    ...enrichedSubmissions.map((s) => s.ms),
  ])

  const options: EChartsOption = {
    tooltip: {
      trigger: ECHARTS.TRIGGER_ITEM,
      formatter: (params) => (params as unknown as { data?: { _tip?: string } }).data?._tip ?? "",
    },
    legend: { type: "scroll", top: 4, data: seriesKeys.map((key) => bucketLabel(key)) },
    grid: { left: 12, right: 24, top: 40, bottom: 56, containLabel: true },
    xAxis: { type: "time", min, max },
    yAxis: { type: "category", data: [laneCompletions, laneSubmissions], inverse: true },
    dataZoom: [
      { type: "slider", filterMode: ECHARTS.FILTER_WEAK, bottom: 8, height: 18 },
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
          <Echarts options={options} height={220} />
          <p className={symbolKeyCss}>{t("submission-symbol-key")}</p>
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
              <th>{t("label-event")}</th>
              <th>{t("label-module")}</th>
              <th>{t("label-exercise")}</th>
              <th>{t("label-when")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{t("label-first-enrolled")}</td>
              <td>{EMPTY_CELL}</td>
              <td>{EMPTY_CELL}</td>
              <td>{dateToString(new Date(enrolledMs))}</td>
            </tr>
            {completions.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.needs_to_be_reviewed ? t("badge-hidden-from-student") : t("label-completed")}
                </td>
                <td>{bucketLabel(bucketKey(c.course_module_id))}</td>
                <td>{EMPTY_CELL}</td>
                <td>{dateToString(new Date(c.completion_date))}</td>
              </tr>
            ))}
            {enrichedSubmissions.map((s, i) => (
              <tr key={i}>
                <td>{t("attempt-number", { n: s.attempt })}</td>
                <td>{bucketLabel(bucketKey(s.course_module_id))}</td>
                <td>{s.exercise_id.slice(0, 8)}</td>
                <td>{dateToString(new Date(s.ms))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {submissions.length >= SUBMISSION_CAP ? (
          <p className={noteCss}>{t("submissions-capped", { count: SUBMISSION_CAP })}</p>
        ) : null}
      </Disclosure>
    </div>
  )
}

export default CourseActivityTimeline
