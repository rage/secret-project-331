import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import LineChart, {
  DAILY_DATE_FORMAT,
  DAILY_PERIOD,
  MONTHLY_DATE_FORMAT,
  MONTHLY_PERIOD,
  Period,
} from "../../LineChart"

import {
  useDailyFirstExerciseSubmissionsQuery,
  useMonthlyFirstExerciseSubmissionsQuery,
} from "@/hooks/stats"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface FirstSubmissionTrendsProps {
  courseId: string
}

const DAYS_TO_SHOW = 90

const FirstSubmissionTrends: React.FC<React.PropsWithChildren<FirstSubmissionTrendsProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>(MONTHLY_PERIOD)

  const {
    data: monthlyData,
    isLoading: monthlyLoading,
    error: monthlyError,
  } = useMonthlyFirstExerciseSubmissionsQuery(courseId, {
    enabled: period === MONTHLY_PERIOD,
  })

  const {
    data: dailyData,
    isLoading: dailyLoading,
    error: dailyError,
  } = useDailyFirstExerciseSubmissionsQuery(courseId, DAYS_TO_SHOW, {
    enabled: period === DAILY_PERIOD,
  })

  const isLoading = period === MONTHLY_PERIOD ? monthlyLoading : dailyLoading
  const error = period === MONTHLY_PERIOD ? monthlyError : dailyError
  const data = period === MONTHLY_PERIOD ? monthlyData : dailyData

  return (
    <LineChart
      data={data}
      isLoading={isLoading}
      error={error}
      period={period}
      setPeriod={setPeriod}
      yAxisName={t("first-submissions")}
      tooltipValueLabel={t("first-submissions")}
      dateFormat={period === MONTHLY_PERIOD ? MONTHLY_DATE_FORMAT : DAILY_DATE_FORMAT}
      statHeading={t("stats-heading-first-submission-trends")}
      instructionText={t("stats-instruction-first-submission-trends")}
    />
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(FirstSubmissionTrends))
