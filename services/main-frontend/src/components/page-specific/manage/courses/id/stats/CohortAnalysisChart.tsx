import { css } from "@emotion/css"
import { format } from "date-fns"
import type { EChartsOption } from "echarts/types/src/export/option"
import React from "react"
import { useTranslation } from "react-i18next"

import { DEFAULT_CHART_HEIGHT, InstructionBox } from "./CourseStatsPage"
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
const MONTHLY_DATE_FORMAT = "yyyy-MM" as const
const DAILY_DATE_FORMAT = "yyyy-MM-dd" as const

const CohortAnalysisChart: React.FC<CohortAnalysisChartProps> = ({
  data,
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
          "#fff6f6",
          "#FFF1F1",
          "#FFEEE8",
          "#FFEBDD",
          "#FFE8D0",
          "#FFE8D0",
          "#FFECC9",
          "#FFF0C2",
          "#FFF4BC",
          "#FFF9B4",
          "#FFF9B4",
          "#FCF8B4",
          "#FAF7B3",
          "#F7F5B3",
          "#F5F5B2",
          "#F3F4B2",
          "#F1F3B2",
          "#EFF2B1",
          "#EEF1B1",
          "#ECF0B0",
          "#EAEFB0",
          "#E8EFB0",
          "#E7EEAF",
          "#E5EDAF",
          "#E3EDAF",
          "#E1ECAF",
          "#E0EBAE",
          "#DEEAAD",
          "#DCE9AD",
          "#DAE9AD",
          "#D9E8AC",
          "#D8E7AC",
          "#D5E6AC",
          "#D4E6AC",
          "#D3E5AB",
          "#D0E4AA",
          "#CFE3AA",
          "#CDE3AA",
          "#CCE2A9",
          "#CAE1A9",
          "#C8E0A9",
          "#C7E0A9",
          "#C5DFA8",
          "#C4DFA7",
          "#C2DEA7",
          "#C1DDA7",
          "#BEDCA6",
          "#BDDBA6",
          "#BBDBA6",
          "#BADAA6",
          "#B8D9A5",
          "#B6D8A5",
          "#B5D7A5",
          "#B3D7A4",
          "#B1D6A3",
          "#B0D6A3",
          "#AED5A3",
          "#ACD4A3",
          "#ABD3A2",
          "#A9D2A2",
          "#A7D1A2",
          "#A6D1A1",
          "#A4D0A0",
          "#A2D0A0",
          "#A1CFA0",
          "#9FCE9F",
          "#9DCD9F",
          "#9BCC9F",
          "#9ACC9F",
          "#98CB9E",
          "#97CA9E",
          "#95C99E",
          "#93C89D",
          "#91C89C",
          "#8FC79C",
          "#8EC69C",
          "#8CC59B",
          "#8BC49B",
          "#89C49B",
          "#87C39B",
          "#85C29A",
          "#83C19A",
          "#81C19A",
          "#80C099",
          "#7EBF98",
          "#7CBE98",
          "#7ABD98",
          "#78BD97",
          "#77BC97",
          "#75BB97",
          "#73BA97",
          "#71B996",
          "#6FB896",
          "#6EB896",
          "#6CB795",
          "#6AB694",
          "#68B594",
          "#67B594",
          "#65B493",
          "#63B393",
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
          min-height: ${DEFAULT_CHART_HEIGHT * 2}px;
          display: flex;
          align-items: center;
          justify-content: center;
        `}
      >
        {isLoading ? (
          <Spinner variant="medium" />
        ) : error ? (
          <ErrorBanner variant="readOnly" error={error} />
        ) : !data || data.length < 2 ? (
          <div>{t("no-data")}</div>
        ) : (
          <Echarts options={chartOptions} height={DEFAULT_CHART_HEIGHT * 2} />
        )}
      </div>
    </>
  )
}

export default CohortAnalysisChart
