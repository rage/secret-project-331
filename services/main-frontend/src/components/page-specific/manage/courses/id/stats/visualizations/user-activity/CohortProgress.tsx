import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import CohortAnalysisChart from "../../CohortAnalysisChart"
import { DAILY_PERIOD, MONTHLY_PERIOD, Period } from "../../LineChart"

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

  return (
    <CohortAnalysisChart
      data={data}
      isLoading={isLoading}
      error={error}
      statHeading={t("stats-heading-cohort-progress")}
      instructionText={t("stats-instruction-cohort-progress")}
      period={period}
      setPeriod={setPeriod}
    />
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(CohortProgress))
