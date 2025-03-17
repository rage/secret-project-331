import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import CohortAnalysisChart from "../../CohortAnalysisChart"
import { DAILY_PERIOD, MONTHLY_PERIOD, Period } from "../../LineChart"

import { useCohortDailyActivityQuery, useCohortWeeklyActivityQuery } from "@/hooks/stats"
import SelectMenu from "@/shared-module/common/components/SelectMenu"
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

  const statHeading =
    period === MONTHLY_PERIOD
      ? t("stats-heading-weekly-cohort-progress")
      : t("stats-heading-daily-cohort-progress")

  const instructionText =
    period === MONTHLY_PERIOD
      ? t("stats-instruction-weekly-cohort-progress")
      : t("stats-instruction-daily-cohort-progress")

  return (
    <>
      <div
        className={css`
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        `}
      >
        <div
          className={css`
            display: flex;
            align-items: center;
            gap: 0.5rem;
          `}
        >
          <h2>{statHeading}</h2>
        </div>
        <SelectMenu
          id="period-select"
          options={[
            { value: MONTHLY_PERIOD, label: t("stats-period-monthly") },
            { value: DAILY_PERIOD, label: t("stats-period-daily") },
          ]}
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className={css`
            margin-bottom: 0;
            min-width: 120px;
          `}
          showDefaultOption={false}
        />
      </div>
      <CohortAnalysisChart
        data={data}
        isLoading={isLoading}
        error={error}
        statHeading={statHeading}
        instructionText={instructionText}
      />
    </>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(CohortProgress))
