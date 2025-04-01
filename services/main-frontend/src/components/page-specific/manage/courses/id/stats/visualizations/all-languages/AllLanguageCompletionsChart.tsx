import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import LineChart, {
  DAILY_DATE_FORMAT,
  DAILY_PERIOD,
  MONTHLY_DATE_FORMAT,
  MONTHLY_PERIOD,
  Period,
} from "../../LineChart"

import { useCourseCompletionsHistoryAllLanguageVersionsQuery } from "@/hooks/stats"
import { TimeGranularity } from "@/shared-module/common/bindings"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface AllLanguageCompletionsChartProps {
  courseId: string
}

const DAYS_TO_SHOW = 90
const MONTHS_TO_SHOW = 12

const AllLanguageCompletionsChart: React.FC<
  React.PropsWithChildren<AllLanguageCompletionsChartProps>
> = ({ courseId }) => {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>(MONTHLY_PERIOD)

  const granularity: TimeGranularity = period === MONTHLY_PERIOD ? MONTHLY_PERIOD : DAILY_PERIOD
  const timeWindow = period === MONTHLY_PERIOD ? MONTHS_TO_SHOW : DAYS_TO_SHOW

  const { data, isLoading, error } = useCourseCompletionsHistoryAllLanguageVersionsQuery(
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
      yAxisName={t("completions")}
      tooltipValueLabel={t("completions")}
      dateFormat={period === MONTHLY_PERIOD ? MONTHLY_DATE_FORMAT : DAILY_DATE_FORMAT}
      statHeading={t("stats-heading-course-completions")}
      instructionText={t("stats-instruction-course-completions")}
    />
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(AllLanguageCompletionsChart))
