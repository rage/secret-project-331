"use client"

import { css } from "@emotion/css"
import type { EChartsOption } from "echarts"
import React from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import Echarts from "@/app/manage/courses/[id]/stats/Echarts"
import type { CourseEnrollmentInfo } from "@/generated/api/types.generated"
import { dateToString } from "@/shared-module/common/utils/time"

export interface CourseCompletionTimelineProps {
  enrollment: CourseEnrollmentInfo
}

const wrapperCss = css`
  margin-top: 1rem;
`

/**
 * A compact time-axis view of one course: enrollment plus each module completion, so a burst of
 * completions in a short window (the strongest "too fast" signal) is visible at a glance. The chart
 * is decorative for assistive tech — the same events are provided as a visually-hidden table.
 */
const CourseCompletionTimeline: React.FC<CourseCompletionTimelineProps> = ({ enrollment }) => {
  const { t } = useTranslation()

  const enrolledAt = new Date(enrollment.first_enrolled_at)
  const completions = [...enrollment.course_module_completions].sort(
    (a, b) => new Date(a.completion_date).getTime() - new Date(b.completion_date).getTime(),
  )

  const moduleName = (courseModuleId: string): string =>
    enrollment.course_modules.find((m) => m.id === courseModuleId)?.name ?? t("default-module")

  const enrollmentPoint = { name: t("label-first-enrolled"), value: [enrolledAt.getTime(), 1] }
  const completionPoints = completions.map((c) => ({
    name: moduleName(c.course_module_id),
    value: [new Date(c.completion_date).getTime(), 1],
    itemStyle: { color: c.needs_to_be_reviewed ? "#9e341f" : "#1f6964" },
  }))

  const options: EChartsOption = {
    tooltip: {},
    grid: { left: 8, right: 16, top: 24, bottom: 24, containLabel: true },
    xAxis: { type: "time" },
    yAxis: { type: "value", min: 0, max: 2, show: false },
    series: [
      {
        type: "scatter",
        symbolSize: 14,
        data: [{ ...enrollmentPoint, itemStyle: { color: "#767b85" } }, ...completionPoints],
      },
    ],
  }

  return (
    <div className={wrapperCss}>
      <Echarts options={options} height={120} />
      <VisuallyHidden>
        <table>
          <caption>{t("completion-timeline-caption")}</caption>
          <thead>
            <tr>
              <th>{t("label-event")}</th>
              <th>{t("label-when")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{t("label-first-enrolled")}</td>
              <td>{dateToString(enrolledAt)}</td>
            </tr>
            {completions.map((c) => (
              <tr key={c.id}>
                <td>{moduleName(c.course_module_id)}</td>
                <td>{dateToString(new Date(c.completion_date))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </div>
  )
}

export default CourseCompletionTimeline
