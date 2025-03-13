import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import ChartWithHeader, {
  DAILY_DATE_FORMAT,
  DAILY_PERIOD,
  MONTHLY_DATE_FORMAT,
  MONTHLY_PERIOD,
  Period,
} from "./ChartWithHeader"

import { useDailyCourseCompletionsQuery, useMonthlyCourseCompletionsQuery } from "@/hooks/stats"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface CompletionsChartProps {
  courseId: string
}

const DAYS_TO_SHOW = 90

const CompletionsChart: React.FC<React.PropsWithChildren<CompletionsChartProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>(MONTHLY_PERIOD)

  const {
    data: monthlyData,
    isLoading: monthlyLoading,
    error: monthlyError,
  } = useMonthlyCourseCompletionsQuery(courseId, {
    enabled: period === MONTHLY_PERIOD,
  })

  const {
    data: dailyData,
    isLoading: dailyLoading,
    error: dailyError,
  } = useDailyCourseCompletionsQuery(courseId, DAYS_TO_SHOW, {
    enabled: period === DAILY_PERIOD,
  })

  const isLoading = period === MONTHLY_PERIOD ? monthlyLoading : dailyLoading
  const error = period === MONTHLY_PERIOD ? monthlyError : dailyError
  const data = period === MONTHLY_PERIOD ? monthlyData : dailyData

  return (
    <ChartWithHeader
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
    />
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(CompletionsChart))
