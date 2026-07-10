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
import {
  colorAt,
  COMPLETION_COLOR,
  COURSE_COLORS,
  ECHARTS,
  NEEDS_REVIEW_COLOR,
  timeAxisBounds,
} from "@/utils/timelineChart"

export interface ActivityTimelineProps {
  enrollments: CourseEnrollmentInfo[]
}

const LINE_BREAK = "<br />"
const TRANSPARENT = "transparent"
const BAR_LABEL_FILL = "#ffffff"

interface CourseBar {
  courseId: string
  name: string
  colorIndex: number
  enrolledMs: number
  lastActivityMs: number
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
 * greedily packed so the lane count equals peak concurrency (how many courses overlapped in time).
 * Module completions are overlaid as dots on each bar. The chart carries an aria description; the same
 * data is available in the expandable table below.
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
    return {
      courseId: enrollment.course_id,
      name: enrollment.course.name,
      colorIndex: index,
      enrolledMs,
      lastActivityMs: completionMs.length > 0 ? Math.max(...completionMs) : enrolledMs,
      completedCount: completedModuleCount(enrollment),
      totalModules: enrollment.course_modules.length,
      reviewCount: enrollment.course_module_completions_needing_review,
    }
  })

  const { packed, laneCount } = packLanes(
    bars.map((bar) => ({ start: bar.enrolledMs, end: bar.lastActivityMs, item: bar })),
  )
  const laneByCourseId = new Map(packed.map((p) => [p.item.courseId, p.lane]))

  const barTip = (bar: CourseBar): string => {
    const lines = [
      bar.name,
      t("tooltip-enrolled", { date: dateToString(new Date(bar.enrolledMs)) }),
      t("tooltip-last-activity", { date: dateToString(new Date(bar.lastActivityMs)) }),
      t("modules-completed-of-total", { completed: bar.completedCount, total: bar.totalModules }),
    ]
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
      return {
        value: [when.getTime(), lane],
        itemStyle: { color: c.needs_to_be_reviewed ? NEEDS_REVIEW_COLOR : COMPLETION_COLOR },
        _tip: [
          moduleName(enrollment, c.course_module_id),
          t("tooltip-completed", { date: dateToString(when) }),
        ].join(LINE_BREAK),
      }
    })
  })

  const renderItem = (
    params: CustomSeriesRenderItemParams,
    api: CustomSeriesRenderItemAPI,
  ): CustomSeriesRenderItemReturn => {
    const lane = api.value(0) as number
    const start = api.coord([api.value(1), lane])
    const end = api.coord([api.value(2), lane])
    const laneHeight = (api.size?.([0, 1]) as number[] | undefined)?.[1] ?? 24
    const height = laneHeight * 0.55
    const width = Math.max(end[0] - start[0], 2)
    const coordSys = params.coordSys as unknown as {
      x: number
      y: number
      width: number
      height: number
    }
    const rect = clipRect(
      { x: start[0], y: start[1] - height / 2, width, height },
      { x: coordSys.x, y: coordSys.y, width: coordSys.width, height: coordSys.height },
    )
    if (!rect) {
      return { type: "group", children: [] }
    }
    const bar = packed[params.dataIndex].item
    return {
      type: "group",
      children: [
        {
          type: "rect",
          shape: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, r: 3 },
          style: {
            fill: colorAt(COURSE_COLORS, bar.colorIndex),
            stroke: bar.reviewCount > 0 ? NEEDS_REVIEW_COLOR : TRANSPARENT,
            lineWidth: bar.reviewCount > 0 ? 2 : 0,
          },
        },
        {
          type: "text",
          style: {
            text: bar.name,
            x: rect.x + 6,
            y: rect.y + rect.height / 2,
            fill: BAR_LABEL_FILL,
            fontSize: 12,
            verticalAlign: ECHARTS.VALIGN_MIDDLE,
            align: ECHARTS.ALIGN_LEFT,
            width: Math.max(rect.width - 12, 0),
            overflow: ECHARTS.OVERFLOW_TRUNCATE,
          },
        },
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
    grid: { left: 12, right: 24, top: 12, bottom: 56, containLabel: true },
    xAxis: { type: "time", min, max },
    yAxis: {
      type: "category",
      data: laneLabels,
      inverse: true,
      axisLabel: { show: false },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    dataZoom: [
      { type: "slider", filterMode: ECHARTS.FILTER_WEAK, bottom: 8, height: 18 },
      { type: "inside", filterMode: ECHARTS.FILTER_WEAK },
    ],
    aria: { enabled: true },
    series: [
      { type: "custom", renderItem, encode: { x: [1, 2], y: 0 }, data: barData },
      { type: "scatter", symbolSize: 9, z: 3, data: completionData },
    ],
  }

  return (
    <div>
      <Echarts options={options} height={Math.max(160, laneCount * 44 + 90)} />
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
              <th>{t("label-first-enrolled")}</th>
              <th>{t("label-last-activity")}</th>
              <th>{t("label-module")}</th>
              <th>{t("stat-awaiting-review")}</th>
            </tr>
          </thead>
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.courseId}>
                <td>{bar.name}</td>
                <td>{dateToString(new Date(bar.enrolledMs))}</td>
                <td>{dateToString(new Date(bar.lastActivityMs))}</td>
                <td>
                  {t("modules-completed-of-total", {
                    completed: bar.completedCount,
                    total: bar.totalModules,
                  })}
                </td>
                <td>{bar.reviewCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Disclosure>
    </div>
  )
}

export default ActivityTimeline
