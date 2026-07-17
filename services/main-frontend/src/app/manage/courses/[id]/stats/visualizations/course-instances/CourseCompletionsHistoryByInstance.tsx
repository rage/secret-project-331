"use client"

import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import type { TimeGranularity } from "@/generated/api/types.generated"
import { useCourseCompletionsHistoryByInstanceQuery } from "@/hooks/stats"

import type { Period } from "../../LineChart"
import {
  DAILY_DATE_FORMAT,
  DAILY_PERIOD,
  MONTHLY_DATE_FORMAT,
  MONTHLY_PERIOD,
} from "../../LineChart"
import LineChartByInstance from "../../LineChartByInstance"

interface CourseCompletionsHistoryByInstanceProps {
  courseId: string
}

const DAYS_TO_SHOW = 90
const MONTHS_TO_SHOW = 12

const CourseCompletionsHistoryByInstance: React.FC<CourseCompletionsHistoryByInstanceProps> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>(MONTHLY_PERIOD)
  const granularity: TimeGranularity = period === MONTHLY_PERIOD ? MONTHLY_PERIOD : DAILY_PERIOD
  const timeWindow = period === MONTHLY_PERIOD ? MONTHS_TO_SHOW : DAYS_TO_SHOW

  const { data, isLoading, error } = useCourseCompletionsHistoryByInstanceQuery(
    courseId,
    granularity,
    timeWindow,
  )

  return (
    <LineChartByInstance
      courseId={courseId}
      data={data}
      isLoading={isLoading}
      error={error}
      period={period}
      setPeriod={setPeriod}
      yAxisName={t("users")}
      tooltipValueLabel={t("users")}
      dateFormat={period === MONTHLY_PERIOD ? MONTHLY_DATE_FORMAT : DAILY_DATE_FORMAT}
      statHeading={t("stats-heading-course-completions")}
      instructionText={t("stats-instruction-course-completions")}
    />
  )
}

export default CourseCompletionsHistoryByInstance
