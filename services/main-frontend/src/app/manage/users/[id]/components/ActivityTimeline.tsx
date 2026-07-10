"use client"

import { css } from "@emotion/css"
import type {
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
  EChartsOption,
} from "echarts"
import React from "react"
import { useTranslation } from "react-i18next"

import { clipRect } from "../lib/clipRect"
import { completedModuleCount } from "../lib/completions"
import { packLanes } from "../lib/lanePacking"

import Echarts from "@/app/manage/courses/[id]/stats/Echarts"
import type { CourseEnrollmentInfo } from "@/generated/api/types.generated"
import { dateToString } from "@/shared-module/common/utils/time"
import { Disclosure } from "@/shared-module/components"
import { computeModuleRows, durationSeconds, formatDuration } from "@/utils/moduleTimeline"
import {
  colorAt,
  ECHARTS,
  REVIEW_ACCENT,
  SERIES_COLORS,
  SPLIT_AREA_COLORS,
  TIME_AXIS_LABEL,
  timeAxisBounds,
} from "@/utils/timelineChart"

export interface ActivityTimelineProps {
  enrollments: CourseEnrollmentInfo[]
}

const LINE_BREAK = "<br />"
const EMPTY_CELL = "—"
const STAR = "★"
const BAR_LABEL_FILL = "#ffffff"
const OUTSIDE_LABEL_FILL = "#1a2333" // gray.700
const DOT_FILL = "#ffffff"
const DOT_BORDER = "#1a2333" // gray.700
const MARK_BORDER = "#ffffff"
const MIN_INSIDE_LABEL_WIDTH = 56
const OUTSIDE_LABEL_WIDTH = 160

interface CourseBar {
  courseId: string
  name: string
  colorIndex: number
  enrolledMs: number
  lastActivityMs: number
  hasActivity: boolean
  completedCount: number
  totalModules: number
  reviewCount: number
}

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

/**
 * Cross-course engagement as a lane-packed Gantt: one bar per course from enrollment to last completion,
 * greedily packed so the lane count equals peak concurrency (how many courses overlapped in time). A
 * course with no activity yet shows as a single diamond at its enrollment. Module completions are
 * overlaid as dots; courses awaiting review carry an info-blue flag (not an alarm border). The chart
 * carries an aria description and the same data is available in the expandable table below.
 */
const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ enrollments }) => {
  const { t } = useTranslation()

  const moduleName = (enrollment: CourseEnrollmentInfo, courseModuleId: string): string =>
    enrollment.course_modules.find((m) => m.id === courseModuleId)?.name ?? t("default-module")

  const bars: CourseBar[] = enrollments.map((enrollment, index) => {
    const enrolledMs = new Date(enrollment.first_enrolled_at).getTime()
    const completionMs = enrollment.course_module_completions.map((c) =>
      new Date(c.completion_date).getTime(),
    )
    const hasActivity = completionMs.length > 0
    return {
      courseId: enrollment.course_id,
      name: enrollment.course.name,
      colorIndex: index,
      enrolledMs,
      lastActivityMs: hasActivity ? Math.max(...completionMs) : enrolledMs,
      hasActivity,
      completedCount: completedModuleCount(enrollment),
      totalModules: enrollment.course_modules.length,
      reviewCount: enrollment.course_module_completions_needing_review,
    }
  })

  const { packed, laneCount } = packLanes(
    bars.map((bar) => ({ start: bar.enrolledMs, end: bar.lastActivityMs, item: bar })),
  )
  const laneByCourseId = new Map(packed.map((p) => [p.item.courseId, p.lane]))

  // Per-module rows per course (for the table) and a flat module→row lookup (for completion tooltips).
  const moduleRowsByCourse = enrollments.map((e) => ({
    courseId: e.course_id,
    name: e.course.name,
    rows: computeModuleRows(e),
  }))
  const rowByModuleId = new Map(
    moduleRowsByCourse.flatMap((c) => c.rows.map((r) => [r.moduleId, r] as const)),
  )

  const barTip = (bar: CourseBar): string => {
    const lines = [
      bar.name,
      t("tooltip-enrolled", { date: dateToString(new Date(bar.enrolledMs)) }),
    ]
    if (bar.hasActivity) {
      lines.push(t("tooltip-last-activity", { date: dateToString(new Date(bar.lastActivityMs)) }))
    }
    lines.push(
      t("modules-completed-of-total", { completed: bar.completedCount, total: bar.totalModules }),
    )
    if (bar.hasActivity) {
      lines.push(
        t("tooltip-total-time", {
          duration: formatDuration(
            durationSeconds(new Date(bar.enrolledMs), new Date(bar.lastActivityMs)),
            t,
          ),
        }),
      )
    }
    if (bar.reviewCount > 0) {
      lines.push(t("awaiting-review-count", { count: bar.reviewCount }))
    }
    return lines.join(LINE_BREAK)
  }

  const barData = packed.map((p) => ({ value: [p.lane, p.start, p.end], _tip: barTip(p.item) }))

  const completionData = enrollments.flatMap((enrollment) => {
    const lane = laneByCourseId.get(enrollment.course_id) ?? 0
    return enrollment.course_module_completions.map((c) => {
      const when = new Date(c.completion_date)
      const row = rowByModuleId.get(c.course_module_id)
      const tip = [
        moduleName(enrollment, c.course_module_id),
        t("tooltip-completed", { date: dateToString(when) }),
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
        value: [when.getTime(), lane],
        _tip: tip.join(LINE_BREAK),
      }
    })
  })

  // Courses awaiting review get an info-blue flag above the bar start — a status marker, not an error.
  const reviewData = enrollments
    .filter((enrollment) => enrollment.course_module_completions_needing_review > 0)
    .map((enrollment) => ({
      value: [
        new Date(enrollment.first_enrolled_at).getTime(),
        laneByCourseId.get(enrollment.course_id) ?? 0,
      ],
      _tip: [
        enrollment.course.name,
        t("awaiting-review-count", { count: enrollment.course_module_completions_needing_review }),
      ].join(LINE_BREAK),
    }))

  const outsideLabel = (x: number, y: number, text: string) => ({
    type: "text" as const,
    style: {
      text,
      x,
      y,
      fill: OUTSIDE_LABEL_FILL,
      fontSize: 12,
      verticalAlign: ECHARTS.VALIGN_MIDDLE,
      align: ECHARTS.ALIGN_LEFT,
      width: OUTSIDE_LABEL_WIDTH,
      overflow: ECHARTS.OVERFLOW_TRUNCATE,
    },
  })

  const renderItem = (
    params: CustomSeriesRenderItemParams,
    api: CustomSeriesRenderItemAPI,
  ): CustomSeriesRenderItemReturn => {
    const lane = api.value(0) as number
    const startMs = api.value(1) as number
    const endMs = api.value(2) as number
    const start = api.coord([startMs, lane])
    const end = api.coord([endMs, lane])
    const laneHeight = (api.size?.([0, 1]) as number[] | undefined)?.[1] ?? 24
    const height = laneHeight * 0.55
    const coordSys = params.coordSys as unknown as {
      x: number
      y: number
      width: number
      height: number
    }
    const bar = packed[params.dataIndex].item
    const color = colorAt(SERIES_COLORS, bar.colorIndex)

    // No activity yet: a single diamond at the enrollment instant, labelled to its right.
    if (!bar.hasActivity) {
      const cx = start[0]
      const cy = start[1]
      if (cx < coordSys.x || cx > coordSys.x + coordSys.width) {
        return { type: "group", children: [] }
      }
      const h = height / 2
      return {
        type: "group",
        children: [
          {
            type: "polygon",
            shape: {
              points: [
                [cx, cy - h],
                [cx + h, cy],
                [cx, cy + h],
                [cx - h, cy],
              ],
            },
            style: { fill: color, stroke: MARK_BORDER, lineWidth: 1 },
          },
          outsideLabel(cx + h + 4, cy, bar.name),
        ],
      }
    }

    const width = Math.max(end[0] - start[0], 3)
    const rect = clipRect(
      { x: start[0], y: start[1] - height / 2, width, height },
      { x: coordSys.x, y: coordSys.y, width: coordSys.width, height: coordSys.height },
    )
    if (!rect) {
      return { type: "group", children: [] }
    }
    const label =
      rect.width >= MIN_INSIDE_LABEL_WIDTH
        ? {
            type: "text" as const,
            style: {
              text: bar.name,
              x: rect.x + 6,
              y: rect.y + rect.height / 2,
              fill: BAR_LABEL_FILL,
              fontSize: 12,
              verticalAlign: ECHARTS.VALIGN_MIDDLE,
              align: ECHARTS.ALIGN_LEFT,
              width: rect.width - 12,
              overflow: ECHARTS.OVERFLOW_TRUNCATE,
            },
          }
        : outsideLabel(rect.x + rect.width + 4, rect.y + rect.height / 2, bar.name)
    return {
      type: "group",
      children: [
        {
          type: "rect",
          shape: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, r: 3 },
          style: { fill: color },
        },
        label,
      ],
    }
  }

  const { min, max } = timeAxisBounds([
    ...bars.map((b) => b.enrolledMs),
    ...bars.map((b) => b.lastActivityMs),
  ])
  const laneLabels = Array.from({ length: laneCount }, (_, i) => String(i))

  const options: EChartsOption = {
    tooltip: {
      trigger: ECHARTS.TRIGGER_ITEM,
      formatter: (params) => (params as unknown as { data?: { _tip?: string } }).data?._tip ?? "",
    },
    grid: { left: 12, right: 24, top: 16, bottom: 30, containLabel: true },
    xAxis: {
      type: "time",
      min,
      max,
      axisLabel: { formatter: TIME_AXIS_LABEL, hideOverlap: true },
      splitArea: { show: true, areaStyle: { color: SPLIT_AREA_COLORS } },
    },
    yAxis: {
      type: "category",
      data: laneLabels,
      inverse: true,
      axisLabel: { show: false },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    aria: { enabled: true },
    series: [
      { type: "custom", renderItem, encode: { x: [1, 2], y: 0 }, data: barData },
      {
        type: "scatter",
        symbolSize: 9,
        z: 3,
        itemStyle: { color: DOT_FILL, borderColor: DOT_BORDER, borderWidth: 1.5 },
        data: completionData,
      },
      {
        type: "scatter",
        symbol: ECHARTS.SYMBOL_PIN,
        symbolSize: 16,
        symbolOffset: [0, ECHARTS.PIN_OFFSET_Y],
        z: 4,
        itemStyle: { color: REVIEW_ACCENT },
        data: reviewData,
      },
    ],
  }

  return (
    <div>
      <Echarts options={options} height={Math.max(140, laneCount * 44 + 70)} />
      <Disclosure title={t("show-underlying-data")}>
        <table className={tableCss}>
          <caption
            className={css`
              text-align: left;
              color: var(--color-gray-500, #535a66);
              padding: 0.25rem 0;
            `}
          >
            {t("gantt-timeline-caption")}
          </caption>
          <thead>
            <tr>
              <th>{t("course")}</th>
              <th>{t("label-module")}</th>
              <th>{t("label-started")}</th>
              <th>{t("label-completed")}</th>
              <th>{t("label-time-in-module")}</th>
              <th>{t("label-since-enrolled")}</th>
            </tr>
          </thead>
          <tbody>
            {moduleRowsByCourse.flatMap((course) =>
              course.rows.map((row, i) => (
                <tr key={row.moduleId}>
                  {i === 0 ? <td rowSpan={course.rows.length}>{course.name}</td> : null}
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
              )),
            )}
          </tbody>
        </table>
      </Disclosure>
    </div>
  )
}

export default ActivityTimeline
