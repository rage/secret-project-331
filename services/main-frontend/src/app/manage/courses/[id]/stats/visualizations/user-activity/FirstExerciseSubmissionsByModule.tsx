"use client"

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

import { useFirstExerciseSubmissionsByModuleQuery } from "@/hooks/stats"
import { TimeGranularity } from "@/shared-module/common/bindings"

interface FirstExerciseSubmissionsByModuleProps {
  courseId: string
}

const DAYS_TO_SHOW = 90
const MONTHS_TO_SHOW = 12

const FirstExerciseSubmissionsByModule: React.FC<FirstExerciseSubmissionsByModuleProps> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>(MONTHLY_PERIOD)

  const granularity: TimeGranularity = period === MONTHLY_PERIOD ? MONTHLY_PERIOD : DAILY_PERIOD

  const timeWindow = period === MONTHLY_PERIOD ? MONTHS_TO_SHOW : DAYS_TO_SHOW

  const { data, isLoading, error } = useFirstExerciseSubmissionsByModuleQuery(
    courseId,
    granularity,
    timeWindow,
  )

  return (
    <LineChartByInstance
      data={data}
      isLoading={isLoading}
      error={error}
      period={period}
      setPeriod={setPeriod}
      yAxisName={t("users")}
      tooltipValueLabel={t("users")}
      dateFormat={period === MONTHLY_PERIOD ? MONTHLY_DATE_FORMAT : DAILY_DATE_FORMAT}
      statHeading={t("stats-heading-first-submission-by-module")}
      instructionText={t("stats-instruction-first-submission-by-module")}
      courseId={courseId}
    />
  )
}

export default FirstExerciseSubmissionsByModule
