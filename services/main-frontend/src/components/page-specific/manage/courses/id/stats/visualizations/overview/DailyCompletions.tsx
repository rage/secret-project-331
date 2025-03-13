import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { InstructionBox, StatHeading } from "../../CourseStatsPage"
import Echarts from "../../Echarts"
import { useLineChartOptions } from "../../chartUtils"

import { useDailyCourseCompletionsQuery } from "@/hooks/stats"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface DailyCompletionsProps {
  courseId: string
}

const DAYS_TO_SHOW = 90 // Show last 90 days of data

const DailyCompletions: React.FC<React.PropsWithChildren<DailyCompletionsProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const {
    data: realData,
    isLoading,
    error,
  } = useDailyCourseCompletionsQuery(courseId, DAYS_TO_SHOW)

  const PLACEHOLDER_DATA = [
    { period: "2024-03-01T00:00:00.000Z", count: 5 },
    { period: "2024-03-02T00:00:00.000Z", count: 8 },
    { period: "2024-03-03T00:00:00.000Z", count: 3 },
    { period: "2024-03-04T00:00:00.000Z", count: 10 },
    { period: "2024-03-05T00:00:00.000Z", count: 7 },
  ]

  // Use real data if available, otherwise use placeholder
  const data = (realData?.length ? realData : PLACEHOLDER_DATA).map((item) => ({
    period: item.period,
    count: item.count,
  }))

  const chartOptions = useLineChartOptions({
    data,
    yAxisName: t("completions"),
    tooltipValueLabel: t("completions"),
    // eslint-disable-next-line i18next/no-literal-string
    dateFormat: "yyyy-MM-dd",
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
        <StatHeading>{t("stats-heading-daily-completions")}</StatHeading>
        <DebugModal
          variant="minimal"
          data={data}
          buttonWrapperStyles={css`
            display: flex;
            align-items: center;
          `}
        />
      </div>
      <InstructionBox>{t("stats-instruction-daily-completions")}</InstructionBox>
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

export default withErrorBoundary(dontRenderUntilQueryParametersReady(DailyCompletions))
