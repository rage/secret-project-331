import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import ChartWithHeader, { MONTHLY_DATE_FORMAT, MONTHLY_PERIOD, Period } from "../../ChartWithHeader"

import { useAvgTimeToFirstSubmissionByMonthQuery } from "@/hooks/stats"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface AverageTimeToSubmitProps {
  courseId: string
}

const AverageTimeToSubmit: React.FC<React.PropsWithChildren<AverageTimeToSubmitProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>(MONTHLY_PERIOD)

  const { data, isLoading, error } = useAvgTimeToFirstSubmissionByMonthQuery(courseId)

  return (
    <ChartWithHeader
      data={data}
      isLoading={isLoading}
      error={error}
      period={period}
      setPeriod={setPeriod}
      yAxisName={t("average-time-minutes")}
      tooltipValueLabel={t("average-time-minutes")}
      dateFormat={MONTHLY_DATE_FORMAT}
      statHeading={t("stats-heading-average-time-to-submit")}
      instructionText={t("stats-instruction-average-time-to-submit")}
      disablePeriodSelector={true}
    />
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(AverageTimeToSubmit))
