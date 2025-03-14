import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import ChartWithHeader, {
  DAILY_DATE_FORMAT,
  DAILY_PERIOD,
  MONTHLY_DATE_FORMAT,
  MONTHLY_PERIOD,
  Period,
} from "../../ChartWithHeader"

import { useCohortDailyActivityQuery, useCohortWeeklyActivityQuery } from "@/hooks/stats"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface CohortProgressProps {
  courseId: string
}

const DAYS_TO_SHOW = 90 // Show last 90 days of data
const MONTHS_TO_SHOW = 12 // Show last 12 months of data

const CohortProgress: React.FC<React.PropsWithChildren<CohortProgressProps>> = ({ courseId }) => {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>(MONTHLY_PERIOD)

  const {
    data: weeklyData,
    isLoading: weeklyLoading,
    error: weeklyError,
  } = useCohortWeeklyActivityQuery(courseId, MONTHS_TO_SHOW, {
    enabled: period === MONTHLY_PERIOD,
  })

  const {
    data: dailyData,
    isLoading: dailyLoading,
    error: dailyError,
  } = useCohortDailyActivityQuery(courseId, DAYS_TO_SHOW, {
    enabled: period === DAILY_PERIOD,
  })

  const isLoading = period === MONTHLY_PERIOD ? weeklyLoading : dailyLoading
  const error = period === MONTHLY_PERIOD ? weeklyError : dailyError
  const data = period === MONTHLY_PERIOD ? weeklyData : dailyData
  const dateFormat = period === MONTHLY_PERIOD ? MONTHLY_DATE_FORMAT : DAILY_DATE_FORMAT

  const statHeading =
    period === MONTHLY_PERIOD
      ? t("stats-heading-weekly-cohort-progress")
      : t("stats-heading-daily-cohort-progress")

  const instructionText =
    period === MONTHLY_PERIOD
      ? t("stats-instruction-weekly-cohort-progress")
      : t("stats-instruction-daily-cohort-progress")

  return (
    <ChartWithHeader
      data={data}
      isLoading={isLoading}
      error={error}
      period={period}
      setPeriod={setPeriod}
      yAxisName={t("cohort-progress")}
      tooltipValueLabel={t("cohort-progress")}
      dateFormat={dateFormat}
      statHeading={statHeading}
      instructionText={instructionText}
    />
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(CohortProgress))
