"use client"

import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import type { Period } from "../../LineChart"
import {
  DAILY_DATE_FORMAT,
  DAILY_PERIOD,
  MONTHLY_DATE_FORMAT,
  MONTHLY_PERIOD,
} from "../../LineChart"
import LineChartByInstance from "../../LineChartByInstance"

import type { TimeGranularity } from "@/generated/api/types.generated"
import { useUniqueUsersStartingHistoryByInstanceQuery } from "@/hooks/stats"

interface UniqueUsersStartingHistoryByInstanceProps {
  courseId: string
}

const DAYS_TO_SHOW = 90
const MONTHS_TO_SHOW = 12

const UniqueUsersStartingHistoryByInstance: React.FC<UniqueUsersStartingHistoryByInstanceProps> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>(MONTHLY_PERIOD)
  const granularity: TimeGranularity = period === MONTHLY_PERIOD ? MONTHLY_PERIOD : DAILY_PERIOD
  const timeWindow = period === MONTHLY_PERIOD ? MONTHS_TO_SHOW : DAYS_TO_SHOW

  const { data, isLoading, error } = useUniqueUsersStartingHistoryByInstanceQuery(
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
      statHeading={t("stats-heading-unique-users-starting-course")}
      instructionText={t("stats-instruction-unique-users-starting-course")}
    />
  )
}

export default UniqueUsersStartingHistoryByInstance
