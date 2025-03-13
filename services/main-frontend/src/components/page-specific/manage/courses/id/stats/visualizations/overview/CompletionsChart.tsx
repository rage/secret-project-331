import { css } from "@emotion/css"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { InstructionBox, StatHeading } from "../../CourseStatsPage"
import Echarts from "../../Echarts"
import { useLineChartOptions } from "../../chartUtils"

import { useDailyCourseCompletionsQuery, useMonthlyCourseCompletionsQuery } from "@/hooks/stats"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import SelectMenu from "@/shared-module/common/components/SelectMenu"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface CompletionsChartProps {
  courseId: string
}

const DAYS_TO_SHOW = 90

const MONTHLY_PERIOD = "monthly"
const DAILY_PERIOD = "daily"

type Period = "daily" | "monthly"

const CompletionsChart: React.FC<React.PropsWithChildren<CompletionsChartProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>(MONTHLY_PERIOD)

  const {
    data: monthlyData,
    isLoading: monthlyLoading,
    error: monthlyError,
  } = useMonthlyCourseCompletionsQuery(courseId)

  const {
    data: dailyData,
    isLoading: dailyLoading,
    error: dailyError,
  } = useDailyCourseCompletionsQuery(courseId, DAYS_TO_SHOW)

  const MONTHLY_PLACEHOLDER_DATA = [
    { period: "2024-01-01T00:00:00.000Z", count: 15 },
    { period: "2024-02-01T00:00:00.000Z", count: 23 },
    { period: "2024-03-01T00:00:00.000Z", count: 18 },
    { period: "2024-04-01T00:00:00.000Z", count: 30 },
    { period: "2024-05-01T00:00:00.000Z", count: 25 },
    { period: "2024-06-01T00:00:00.000Z", count: 35 },
  ]

  const DAILY_PLACEHOLDER_DATA = [
    { period: "2024-03-01T00:00:00.000Z", count: 5 },
    { period: "2024-03-02T00:00:00.000Z", count: 8 },
    { period: "2024-03-03T00:00:00.000Z", count: 3 },
    { period: "2024-03-04T00:00:00.000Z", count: 10 },
    { period: "2024-03-05T00:00:00.000Z", count: 7 },
  ]

  const isLoading = period === "monthly" ? monthlyLoading : dailyLoading
  const error = period === "monthly" ? monthlyError : dailyError

  // Use real data if available, otherwise use placeholder
  const data =
    period === "monthly"
      ? monthlyData?.length
        ? monthlyData
        : MONTHLY_PLACEHOLDER_DATA
      : dailyData?.length
        ? dailyData
        : DAILY_PLACEHOLDER_DATA

  const chartOptions = useLineChartOptions({
    data,
    yAxisName: t("completions"),
    tooltipValueLabel: t("completions"),
    // eslint-disable-next-line i18next/no-literal-string
    dateFormat: period === "monthly" ? "yyyy-MM" : "yyyy-MM-dd",
  })

  if (error) {
    return <ErrorBanner variant="readOnly" error={error} />
  }

  if (isLoading) {
    return <Spinner variant="medium" />
  }

  if (!data || data.length === 0) {
    return <div>{t("no-data")}</div>
  }

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
          <StatHeading>{t("stats-heading-course-completions")}</StatHeading>
          <DebugModal
            variant="minimal"
            data={data}
            buttonWrapperStyles={css`
              display: flex;
              align-items: center;
            `}
          />
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
      <InstructionBox>{t("stats-instruction-course-completions")}</InstructionBox>
      <div
        className={css`
          margin-bottom: 2rem;
          border: 3px solid ${baseTheme.colors.clear[200]};
          border-radius: 6px;
          padding: 1rem;
        `}
      >
        <Echarts options={chartOptions} height={300} />
      </div>
    </>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(CompletionsChart))
