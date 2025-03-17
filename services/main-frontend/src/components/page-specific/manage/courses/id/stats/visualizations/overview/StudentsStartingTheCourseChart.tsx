import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import LineChart, {
  DAILY_DATE_FORMAT,
  DAILY_PERIOD,
  MONTHLY_DATE_FORMAT,
  MONTHLY_PERIOD,
  Period,
} from "../../LineChart"

import { useDailyUniqueUsersStartingQuery, useMonthlyUniqueUsersStartingQuery } from "@/hooks/stats"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface StudentsStartingTheCourseChartProps {
  courseId: string
}

const DAYS_TO_SHOW = 90

const StudentsStartingTheCourseChart: React.FC<
  React.PropsWithChildren<StudentsStartingTheCourseChartProps>
> = ({ courseId }) => {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>(MONTHLY_PERIOD)

  const {
    data: monthlyData,
    isLoading: monthlyLoading,
    error: monthlyError,
  } = useMonthlyUniqueUsersStartingQuery(courseId, {
    enabled: period === MONTHLY_PERIOD,
  })

  const {
    data: dailyData,
    isLoading: dailyLoading,
    error: dailyError,
  } = useDailyUniqueUsersStartingQuery(courseId, DAYS_TO_SHOW, {
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
      yAxisName={t("unique-users")}
      tooltipValueLabel={t("unique-users")}
      dateFormat={period === MONTHLY_PERIOD ? MONTHLY_DATE_FORMAT : DAILY_DATE_FORMAT}
      statHeading={t("stats-heading-unique-users-starting-course")}
      instructionText={t("stats-instruction-unique-users-starting-course")}
    />
  )
}

export default withErrorBoundary(
  dontRenderUntilQueryParametersReady(StudentsStartingTheCourseChart),
)
