import { css } from "@emotion/css"
import { format } from "date-fns"
import type { EChartsOption } from "echarts/types/src/export/option"
import React from "react"
import { useTranslation } from "react-i18next"

import { InstructionBox } from "./CourseStatsPage"
import Echarts from "./Echarts"
import { DAILY_PERIOD, MONTHLY_PERIOD, Period } from "./LineChart"
import StatsHeader from "./StatsHeader"

import { CohortActivity } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import SelectMenu from "@/shared-module/common/components/SelectMenu"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"

interface CohortAnalysisChartProps {
  data: CohortActivity[] | undefined
  isLoading: boolean
  error: Error | undefined | null
  statHeading: string
  instructionText: string
  period?: Period
  setPeriod?: React.Dispatch<React.SetStateAction<Period>>
  disablePeriodSelector?: boolean
}

const CHART_POSITION = "top" as const
const CHART_ORIENTATION = "horizontal" as const
const CHART_ALIGNMENT = "center" as const
const CHART_TYPE = "heatmap" as const
const DATE_FORMAT = "yyyy-MM" as const

const CohortAnalysisChart: React.FC<CohortAnalysisChartProps> = ({
  data,
  isLoading,
  error,
  statHeading,
  instructionText,
  period,
  setPeriod,
  disablePeriodSelector = false,
}) => {
  const { t } = useTranslation()

  const processData = (rawData: CohortActivity[] | undefined) => {
    if (!rawData || rawData.length === 0) {
      return { cohorts: [], dayOffsets: [], chartData: [] }
    }

    // Get unique cohort starts and day offsets
    const cohorts = Array.from(new Set(rawData.map((item) => item.cohort_start)))
      .filter((date): date is string => date !== null)
      .sort()

    const dayOffsets = Array.from(new Set(rawData.map((item) => item.offset)))
      .filter((offset): offset is number => offset !== null)
      .sort((a, b) => a - b)

    // Transform data into format needed for heatmap
    const chartData = rawData
      .filter((item) => item.cohort_start !== null && item.offset !== null)
      .map((item) => {
        const cohortIndex = cohorts.indexOf(item.cohort_start!)
        return [item.offset, cohortIndex, item.active_users]
      })

    return { cohorts, dayOffsets, chartData }
  }

  const { cohorts, dayOffsets, chartData } = processData(data)

  const chartOptions: EChartsOption = {
    tooltip: {
      position: CHART_POSITION,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (params: any) => {
        const data = params.data as [number, number, number]
        const cohortDate = cohorts[data[1]]
        const dayOffset = data[0]
        const activeUsers = data[2]
        const formattedDate = format(new Date(cohortDate), DATE_FORMAT)
        return t("cohort-analysis-tooltip", {
          cohort: formattedDate,
          days: dayOffset,
          users: activeUsers,
        })
      },
    },
    grid: {
      height: "60%",
      top: "10%",
    },
    xAxis: {
      type: "category" as const,
      data: dayOffsets,
      name: t("stats-axis-days-after-start"),
      splitArea: {
        show: true,
      },
    },
    yAxis: {
      type: "category" as const,
      data: cohorts.map((date) => format(new Date(date), DATE_FORMAT)),
      name: t("stats-axis-cohort-start"),
      splitArea: {
        show: true,
      },
    },
    visualMap: {
      min: 0,
      max: Math.max(1, ...chartData.map((item) => item[2] as number)),
      calculable: true,
      orient: CHART_ORIENTATION,
      left: CHART_ALIGNMENT,
      bottom: "5%",
      inRange: {
        color: ["#f6efa6", "#d88273", "#bf444c"],
      },
      outOfRange: {
        color: "#f6efa6",
      },
    },
    series: [
      {
        name: t("stats-label-active-users"),
        type: CHART_TYPE,
        data: chartData,
        label: {
          show: true,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: "rgba(0, 0, 0, 0.5)",
          },
        },
      },
    ],
  }

  return (
    <>
      <StatsHeader heading={statHeading} debugData={data}>
        {!disablePeriodSelector && period && setPeriod && (
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
        )}
      </StatsHeader>
      <InstructionBox>{instructionText}</InstructionBox>
      <div
        className={css`
          margin-bottom: 2rem;
          border: 3px solid ${baseTheme.colors.clear[200]};
          border-radius: 6px;
          padding: 1rem;
          min-height: 400px;
          display: flex;
          align-items: center;
          justify-content: center;
        `}
      >
        {isLoading ? (
          <Spinner variant="medium" />
        ) : error ? (
          <ErrorBanner variant="readOnly" error={error} />
        ) : !data || data.length === 0 ? (
          <div>{t("no-data")}</div>
        ) : (
          <Echarts options={chartOptions} height={400} />
        )}
      </div>
    </>
  )
}

export default CohortAnalysisChart
