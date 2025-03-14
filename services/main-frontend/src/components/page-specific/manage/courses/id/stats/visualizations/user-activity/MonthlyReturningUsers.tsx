import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import ChartWithHeader, { MONTHLY_DATE_FORMAT, MONTHLY_PERIOD, Period } from "../../ChartWithHeader"

import { useMonthlyUsersReturningExercisesQuery } from "@/hooks/stats"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface MonthlyReturningUsersProps {
  courseId: string
}

const MonthlyReturningUsers: React.FC<React.PropsWithChildren<MonthlyReturningUsersProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>(MONTHLY_PERIOD)

  const { data, isLoading, error } = useMonthlyUsersReturningExercisesQuery(courseId)

  return (
    <ChartWithHeader
      data={data}
      isLoading={isLoading}
      error={error}
      period={period}
      setPeriod={setPeriod}
      yAxisName={t("returning-users")}
      tooltipValueLabel={t("returning-users")}
      dateFormat={MONTHLY_DATE_FORMAT}
      statHeading={t("stats-heading-returning-users-monthly")}
      instructionText={t("stats-instruction-returning-users-monthly")}
      // Since this is monthly data only, we disable the period selector
      disablePeriodSelector={true}
    />
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(MonthlyReturningUsers))
