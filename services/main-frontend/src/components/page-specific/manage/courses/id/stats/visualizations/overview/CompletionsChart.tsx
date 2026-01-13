"use client"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import LineChart, {
  CUSTOM_PERIOD,
  DAILY_DATE_FORMAT,
  DAILY_PERIOD,
  MONTHLY_DATE_FORMAT,
  MONTHLY_PERIOD,
  Period,
} from "../../LineChart"

import {
  useCourseCompletionsHistoryCustomTimePeriodQuery,
  useCourseCompletionsHistoryQuery,
} from "@/hooks/stats"
import { TimeGranularity } from "@/shared-module/common/bindings"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface CompletionsChartProps {
  courseId: string
}

const DAYS_TO_SHOW = 90
const MONTHS_TO_SHOW = 12

const CompletionsChart: React.FC<React.PropsWithChildren<CompletionsChartProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>(MONTHLY_PERIOD)
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)

  const granularity: TimeGranularity = period === MONTHLY_PERIOD ? MONTHLY_PERIOD : DAILY_PERIOD
  const timeWindow = period === MONTHLY_PERIOD ? MONTHS_TO_SHOW : DAYS_TO_SHOW

  const customQuery = useCourseCompletionsHistoryCustomTimePeriodQuery(
    courseId,
    startDate ?? "",
    endDate ?? "",
    {
      enabled: period === CUSTOM_PERIOD && startDate !== null && endDate !== null,
    },
  )

  const normalQuery = useCourseCompletionsHistoryQuery(courseId, granularity, timeWindow, {
    enabled: period !== CUSTOM_PERIOD,
  })

  const { data, isLoading, error } = period === CUSTOM_PERIOD ? customQuery : normalQuery

  return (
    <LineChart
      data={data}
      isLoading={isLoading}
      error={error}
      period={period}
      setPeriod={setPeriod}
      yAxisName={t("completions")}
      tooltipValueLabel={t("completions")}
      dateFormat={period === MONTHLY_PERIOD ? MONTHLY_DATE_FORMAT : DAILY_DATE_FORMAT}
      statHeading={t("stats-heading-course-completions")}
      instructionText={t("stats-instruction-course-completions")}
      showCustomTimePeriodSelector={true}
      startDate={startDate}
      endDate={endDate}
      setStartDate={setStartDate}
      setEndDate={setEndDate}
    />
  )
}

export default withErrorBoundary(CompletionsChart)
