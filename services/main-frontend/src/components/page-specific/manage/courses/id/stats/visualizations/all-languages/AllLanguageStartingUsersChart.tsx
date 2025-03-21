import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import LineChart, {
  DAILY_DATE_FORMAT,
  DAILY_PERIOD,
  MONTHLY_DATE_FORMAT,
  MONTHLY_PERIOD,
  Period,
} from "../../LineChart"

import { useUniqueUsersStartingHistoryAllLanguageVersionsQuery } from "@/hooks/stats"
import { TimeGranularity } from "@/shared-module/common/bindings"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface AllLanguageStartingUsersChartProps {
  courseId: string
}

const DAYS_TO_SHOW = 90
const MONTHS_TO_SHOW = 12

const AllLanguageStartingUsersChart: React.FC<
  React.PropsWithChildren<AllLanguageStartingUsersChartProps>
> = ({ courseId }) => {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>(MONTHLY_PERIOD)

  const granularity: TimeGranularity = period === MONTHLY_PERIOD ? MONTHLY_PERIOD : DAILY_PERIOD
  const timeWindow = period === MONTHLY_PERIOD ? MONTHS_TO_SHOW : DAYS_TO_SHOW

  const { data, isLoading, error } = useUniqueUsersStartingHistoryAllLanguageVersionsQuery(
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
      yAxisName={t("users")}
      tooltipValueLabel={t("users")}
      dateFormat={period === MONTHLY_PERIOD ? MONTHLY_DATE_FORMAT : DAILY_DATE_FORMAT}
      statHeading={t("stats-heading-students-started-the-course")}
      instructionText={t("stats-instruction-unique-users-starting-course")}
    />
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(AllLanguageStartingUsersChart))
