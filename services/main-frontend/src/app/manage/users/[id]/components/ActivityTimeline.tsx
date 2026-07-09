"use client"

import type { EChartsOption } from "echarts"
import React from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import Echarts from "@/app/manage/courses/[id]/stats/Echarts"
import type { CourseEnrollmentInfo } from "@/generated/api/types.generated"
import { dateToString } from "@/shared-module/common/utils/time"

export interface ActivityTimelineProps {
  enrollments: CourseEnrollmentInfo[]
}

interface TimelineRow {
  course: string
  event: string
  when: Date
}

/**
 * Cross-course activity on a single time axis: one lane per course, with enrollment and each module
 * completion plotted, so whole-account patterns (e.g. a cluster of completions across courses) are
 * visible. Lanes are keyed by course id (course names are not unique) and labelled by name. Decorative
 * for assistive tech — the same rows are exposed as a visually-hidden table.
 */
const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ enrollments }) => {
  const { t } = useTranslation()

  const moduleName = (enrollment: CourseEnrollmentInfo, courseModuleId: string): string =>
    enrollment.course_modules.find((m) => m.id === courseModuleId)?.name ?? t("default-module")

  // Keyed by course id so two courses that share a display name stay on separate lanes.
  const laneIds = enrollments.map((e) => e.course_id)
  const nameByCourseId = new Map(enrollments.map((e) => [e.course_id, e.course.name]))
  const rows: TimelineRow[] = []
  const enrollmentData: { value: [number, string] }[] = []
  const completionData: { value: [number, string]; itemStyle: { color: string } }[] = []

  enrollments.forEach((enrollment) => {
    const enrolledAt = new Date(enrollment.first_enrolled_at)
    enrollmentData.push({ value: [enrolledAt.getTime(), enrollment.course_id] })
    rows.push({
      course: enrollment.course.name,
      event: t("label-first-enrolled"),
      when: enrolledAt,
    })
    enrollment.course_module_completions.forEach((c) => {
      const when = new Date(c.completion_date)
      completionData.push({
        value: [when.getTime(), enrollment.course_id],
        itemStyle: { color: c.needs_to_be_reviewed ? "#9e341f" : "#1f6964" },
      })
      rows.push({
        course: enrollment.course.name,
        event: moduleName(enrollment, c.course_module_id),
        when,
      })
    })
  })

  const options: EChartsOption = {
    tooltip: {},
    grid: { left: 8, right: 16, top: 16, bottom: 24, containLabel: true },
    xAxis: { type: "time" },
    yAxis: {
      type: "category",
      data: laneIds,
      axisLabel: { formatter: (id: string) => nameByCourseId.get(id) ?? id },
    },
    series: [
      {
        name: t("label-first-enrolled"),
        type: "scatter",
        symbolSize: 10,
        itemStyle: { color: "#767b85", opacity: 0.6 },
        data: enrollmentData,
      },
      {
        name: t("label-completed"),
        type: "scatter",
        symbolSize: 12,
        data: completionData,
      },
    ],
  }

  return (
    <div>
      <Echarts options={options} height={Math.max(140, laneIds.length * 40 + 60)} />
      <VisuallyHidden>
        <table>
          <caption>{t("activity-timeline-caption")}</caption>
          <thead>
            <tr>
              <th>{t("course")}</th>
              <th>{t("label-event")}</th>
              <th>{t("label-when")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td>{row.course}</td>
                <td>{row.event}</td>
                <td>{dateToString(row.when)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </div>
  )
}

export default ActivityTimeline
