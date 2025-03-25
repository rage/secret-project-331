import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import {
  DAILY_DATE_FORMAT,
  DAILY_PERIOD,
  MONTHLY_DATE_FORMAT,
  MONTHLY_PERIOD,
  Period,
} from "../../LineChart"
import LineChartByInstance from "../../LineChartByInstance"

import { useFirstExerciseSubmissionsHistoryByInstanceQuery } from "@/hooks/stats"
import { TimeGranularity } from "@/shared-module/common/bindings"

interface FirstExerciseSubmissionsHistoryByInstanceProps {
  courseId: string
}

const DAYS_TO_SHOW = 90
const MONTHS_TO_SHOW = 12

const FirstExerciseSubmissionsHistoryByInstance: React.FC<
  FirstExerciseSubmissionsHistoryByInstanceProps
> = ({ courseId }) => {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>(MONTHLY_PERIOD)
  const granularity: TimeGranularity = period === MONTHLY_PERIOD ? MONTHLY_PERIOD : DAILY_PERIOD
  const timeWindow = period === MONTHLY_PERIOD ? MONTHS_TO_SHOW : DAYS_TO_SHOW

  const { data, isLoading, error } = useFirstExerciseSubmissionsHistoryByInstanceQuery(
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
      statHeading={t("stats-heading-first-submission-trends")}
      instructionText={t("stats-instruction-first-submission-trends")}
    />
  )
}

export default FirstExerciseSubmissionsHistoryByInstance
