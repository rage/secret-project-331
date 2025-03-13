import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { InstructionBox, StatHeading } from "../../CourseStatsPage"
import Echarts from "../../Echarts"
import { useLineChartOptions } from "../../chartUtils"

import { useMonthlyCourseCompletionsQuery } from "@/hooks/stats"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface MonthlyCompletionsProps {
  courseId: string
}

const MonthlyCompletions: React.FC<React.PropsWithChildren<MonthlyCompletionsProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()

  // export interface CountResult {
  //   period: string | null
  //   count: number
  // }
  // The data is an array of these
  const { data: realData, isLoading, error } = useMonthlyCourseCompletionsQuery(courseId)

  // Add placeholder data for preview/development
  const PLACEHOLDER_DATA = [
    { period: "2024-01-01T00:00:00.000Z", count: 15 },
    { period: "2024-02-01T00:00:00.000Z", count: 23 },
    { period: "2024-03-01T00:00:00.000Z", count: 18 },
    { period: "2024-04-01T00:00:00.000Z", count: 30 },
    { period: "2024-05-01T00:00:00.000Z", count: 25 },
    { period: "2024-06-01T00:00:00.000Z", count: 35 },
  ]

  // Use real data if available, otherwise use placeholder
  const data = realData?.length ? realData : PLACEHOLDER_DATA

  const chartOptions = useLineChartOptions({
    data,
    yAxisName: t("completions"),
    tooltipValueLabel: t("completions"),
    // eslint-disable-next-line i18next/no-literal-string
    dateFormat: "yyyy-MM",
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
          gap: 0.5rem;
        `}
      >
        <StatHeading>{t("stats-heading-monthly-completions")}</StatHeading>
        <DebugModal
          variant="minimal"
          data={data}
          buttonWrapperStyles={css`
            display: flex;
            align-items: center;
          `}
        />
      </div>
      <InstructionBox>{t("stats-instruction-monthly-completions")}</InstructionBox>
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

export default withErrorBoundary(dontRenderUntilQueryParametersReady(MonthlyCompletions))
