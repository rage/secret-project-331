import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import CohortAnalysisChart from "../../CohortAnalysisChart"
import { DAILY_PERIOD, MONTHLY_PERIOD, Period } from "../../LineChart"

import { useCohortActivityHistoryQuery } from "@/hooks/stats"
import { TimeGranularity } from "@/shared-module/common/bindings"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface CohortProgressProps {
  courseId: string
}

const DAYS_TO_SHOW = 90 // Show last 90 days of data
const MONTHS_TO_SHOW = 12 // Show last 12 months of data
const TRACKING_WINDOW = 7 // Track 7 units (days/months) after cohort start

const CohortProgress: React.FC<React.PropsWithChildren<CohortProgressProps>> = ({ courseId }) => {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>(MONTHLY_PERIOD)

  const granularity: TimeGranularity = period === MONTHLY_PERIOD ? MONTHLY_PERIOD : DAILY_PERIOD
  const historyWindow = period === MONTHLY_PERIOD ? MONTHS_TO_SHOW : DAYS_TO_SHOW

  const { data, isLoading, error } = useCohortActivityHistoryQuery(
    courseId,
    granularity,
    historyWindow,
    TRACKING_WINDOW,
  )

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
