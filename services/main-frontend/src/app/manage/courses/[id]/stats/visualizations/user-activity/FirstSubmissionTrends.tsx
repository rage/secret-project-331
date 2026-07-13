"use client"

import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import type { Period } from "../../LineChart"
import LineChart, {
  DAILY_DATE_FORMAT,
  DAILY_PERIOD,
  MONTHLY_DATE_FORMAT,
  MONTHLY_PERIOD,
} from "../../LineChart"

import type { TimeGranularity } from "@/generated/api/types.generated"
import { useFirstExerciseSubmissionsHistoryQuery } from "@/hooks/stats"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface FirstSubmissionTrendsProps {
  courseId: string
}

const DAYS_TO_SHOW = 90
const MONTHS_TO_SHOW = 12

const FirstSubmissionTrends: React.FC<React.PropsWithChildren<FirstSubmissionTrendsProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>(MONTHLY_PERIOD)

  const granularity: TimeGranularity = period === MONTHLY_PERIOD ? MONTHLY_PERIOD : DAILY_PERIOD
  const timeWindow = period === MONTHLY_PERIOD ? MONTHS_TO_SHOW : DAYS_TO_SHOW

  const { data, isLoading, error } = useFirstExerciseSubmissionsHistoryQuery(
    courseId,
    granularity,
    timeWindow,
  )

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

export default withErrorBoundary(FirstSubmissionTrends)
