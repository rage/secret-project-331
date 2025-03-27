import { css } from "@emotion/css"
import { format } from "date-fns"
import type { EChartsOption } from "echarts/types/src/export/option"
import React from "react"
import { useTranslation } from "react-i18next"

import { InstructionBox } from "./CourseStatsPage"
import Echarts from "./Echarts"
import { DAILY_PERIOD, MONTHLY_PERIOD, Period } from "./LineChart"
import StatsHeader from "./StatsHeader"
// For development only
import data from "./devdata.json"

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
const MONTHLY_DATE_FORMAT = "yyyy-MM" as const
const DAILY_DATE_FORMAT = "yyyy-MM-dd" as const

const CohortAnalysisChart: React.FC<CohortAnalysisChartProps> = ({
  // data,
  isLoading,
  error,
  statHeading,
  instructionText,
  period = MONTHLY_PERIOD,
  setPeriod,
  disablePeriodSelector = false,
}) => {
  const { t } = useTranslation()

  const processData = (rawData: CohortActivity[] | undefined) => {
    if (!rawData || rawData.length === 0) {
      return { cohorts: [], dayOffsets: [], chartData: [], cohortSizes: {} }
    }

    // Get unique cohort starts and day offsets
    const cohorts = Array.from(new Set(rawData.map((item) => item.cohort_start)))
      .filter((date): date is string => date !== null)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime()) // Reverse sort - newest first

    const dayOffsets = Array.from(new Set(rawData.map((item) => item.offset)))
      .filter((offset): offset is number => offset !== null)
      .sort((a, b) => a - b)

    // Calculate initial size for each cohort (users at offset 0)
    const cohortSizes: Record<string, number> = {}

    for (const cohort of cohorts) {
      const initialData = rawData.find((item) => item.cohort_start === cohort && item.offset === 0)
      cohortSizes[cohort] = initialData?.active_users || 0
    }

    // Create a map of existing data points for quick lookup
    const dataMap = new Map(
      rawData
        .filter((item) => item.cohort_start !== null && item.offset !== null)
        .map((item) => [`${item.cohort_start}-${item.offset}`, item]),
    )

    // Calculate current date to filter out future dates
    const currentDate = new Date()

    // Generate complete chart data including zeros for missing points
    const chartData: [number, number, number, number][] = []

    for (let cohortIndex = 0; cohortIndex < cohorts.length; cohortIndex++) {
      const cohortDate = new Date(cohorts[cohortIndex])
      const initialSize = cohortSizes[cohorts[cohortIndex]] || 1

      for (const offset of dayOffsets) {
        // Calculate if this point would be in the future
        const pointDate = new Date(cohortDate)
        if (period === MONTHLY_PERIOD) {
          pointDate.setMonth(pointDate.getMonth() + offset)
        } else {
          pointDate.setDate(pointDate.getDate() + offset)
        }

        // Only include points that aren't in the future
        if (pointDate <= currentDate) {
          const existingData = dataMap.get(`${cohorts[cohortIndex]}-${offset}`)
          if (existingData) {
            // Use existing data
            const percentRetention = Math.min(
              100,
              initialSize > 0 ? (existingData.active_users / initialSize) * 100 : 0,
            )
            chartData.push([offset, cohortIndex, percentRetention, existingData.active_users])
          } else {
            // Insert zero for missing data
            chartData.push([offset, cohortIndex, 0, 0])
          }
        }
      }
    }

    return { cohorts, dayOffsets, chartData, cohortSizes }
  }

  const { cohorts, dayOffsets, chartData, cohortSizes } = processData(data)

  // Debug log
  console.log(
    "Chart data points with 100%:",
    chartData
      .filter((point) => point[2] === 100)
      .map((point) => ({
        offset: point[0],
        cohortIndex: point[1],
        percentage: point[2],
        activeUsers: point[3],
        cohortDate: cohorts[point[1]],
      })),
  )

  const chartOptions: EChartsOption = {
    tooltip: {
      position: CHART_POSITION,
      formatter: (params) => {
        if (Array.isArray(params)) {
          throw new Error("Tooltip params is an array")
        }
        const data = params.data as [number, number, number, number]
        const cohortDate = cohorts[data[1]]
        const offset = data[0]
        const percentRetention = data[2].toFixed(1)
        const activeUsers = data[3]
        const formattedDate = format(
          new Date(cohortDate),
          period === MONTHLY_PERIOD ? MONTHLY_DATE_FORMAT : DAILY_DATE_FORMAT,
        )
        const initialSize = cohortSizes[cohortDate] || 0

        return t(
          period === MONTHLY_PERIOD
            ? "cohort-analysis-tooltip-monthly-percent"
            : "cohort-analysis-tooltip-daily-percent",
          {
            cohort: formattedDate,
            daysAfterStart: offset,
            monthsAfterStart: offset,
            percent: percentRetention,
            users: activeUsers,
            initialUsers: initialSize,
          },
        )
      },
    },
    grid: {
      height: "70%",
      top: "10%",
      left: "10%",
      right: "5%",
    },
    xAxis: {
      type: "category" as const,
      data: dayOffsets,
      name: t(
        period === MONTHLY_PERIOD ? "stats-axis-months-after-start" : "stats-axis-days-after-start",
      ),
      splitArea: {
        show: true,
      },
    },
    yAxis: {
      type: "category" as const,
      data: cohorts.map((date) =>
        format(new Date(date), period === MONTHLY_PERIOD ? MONTHLY_DATE_FORMAT : DAILY_DATE_FORMAT),
      ),
      name: t("stats-axis-cohort-start"),
      splitArea: {
        show: true,
      },
    },
    visualMap: {
      type: "continuous",
      min: 0,
      max: 100,
      dimension: 2,
      orient: CHART_ORIENTATION,
      left: CHART_ALIGNMENT,
      bottom: "5%",
      precision: 1,
      itemWidth: 10,
      itemHeight: 200,
      textStyle: {
        color: "#333",
      },
      inRange: {
        color: [
          "#ffb8b8", // 0%
          "#FFA587", // 1%
          "#FFA785", // 3%
          "#FFA884", // 4%
          "#FFAA82", // 6%
          "#FFAC80", // 7%
          "#FFAD7F", // 9%
          "#FFAF7D", // 10%
          "#FFB17B", // 11%
          "#FFB27A", // 13%
          "#FFB478", // 14%
          "#FFB478", // 16%
          "#FFB676", // 17%
          "#FFB874", // 19%
          "#FFBA72", // 20%
          "#FFBC70", // 21%
          "#FFBF6D", // 23%
          "#FFC16B", // 24%
          "#FFC369", // 26%
          "#FFC567", // 27%
          "#FFC765", // 29%
          "#FFC963", // 30%
          "#FFCB61", // 31%
          "#FFCD5F", // 33%
          "#FFCF5D", // 34%
          "#FFD15B", // 36%
          "#FFD458", // 37%
          "#FFD656", // 39%
          "#FFD854", // 40%
          "#FFDA52", // 41%
          "#FFDC50", // 43%
          "#FFDC50", // 44%
          "#F9DB51", // 46%
          "#F4D951", // 47%
          "#EED852", // 49%
          "#E9D752", // 50%
          "#E3D653", // 51%
          "#DED453", // 53%
          "#D8D354", // 54%
          "#D3D254", // 56%
          "#CDD055", // 57%
          "#C8CF55", // 59%
          "#C2CE56", // 60%
          "#BDCD56", // 61%
          "#B7CB57", // 63%
          "#B2CA57", // 64%
          "#ACC958", // 66%
          "#A7C758", // 67%
          "#A1C659", // 69%
          "#9CC559", // 70%
          "#96C45A", // 71%
          "#91C25A", // 73%
          "#8BC15B", // 74%
          "#86C05B", // 76%
          "#80BF5C", // 77%
          "#7BBD5C", // 79%
          "#75BC5D", // 80%
          "#70BB5D", // 81%
          "#6AB95E", // 83%
          "#65B85E", // 84%
          "#5FB75F", // 86%
          "#5AB65F", // 87%
          "#54B460", // 89%
          "#4FB360", // 90%
          "#49B261", // 91%
          "#44B061", // 93%
          "#3EAF62", // 94%
          "#39AE62", // 96%
          "#33AD63", // 97%
          "#2EAB63", // 99%
          "#28AA64", // 100%
        ],
      },
      outOfRange: {
        color: ["#333333"],
      },
      splitNumber: 10,
    },
    series: [
      {
        name: t("stats-label-retention-rate"),
        type: CHART_TYPE,
        data: chartData,
        label: {
          show: true,
          formatter: (params) => {
            if (!params.data || !Array.isArray(params.data)) {
              return "0%"
            }
            const value = typeof params.data[2] === "number" ? params.data[2] : 0
            return `${value.toFixed(0)}%`
          },
        },
        itemStyle: {
          borderWidth: 1,
          borderColor: "#ffffff",
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
          min-height: 600px;
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
          <Echarts options={chartOptions} height={600} />
        )}
      </div>
    </>
  )
}

export default CohortAnalysisChart
