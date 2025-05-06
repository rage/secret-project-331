import { css } from "@emotion/css"
import { format } from "date-fns"
import type { EChartsOption } from "echarts/types/src/export/option"
import { ZRColor } from "echarts/types/src/util/types"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { DEFAULT_CHART_HEIGHT, InstructionBox } from "./CourseStatsPage"
import Echarts from "./Echarts"
import { DAILY_PERIOD, MONTHLY_PERIOD, Period } from "./LineChart"
import StatsHeader from "./StatsHeader"

import useCourseInstancesQuery from "@/hooks/useCourseInstancesQuery"
import { CountResult } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import SelectMenu from "@/shared-module/common/components/SelectMenu"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"

interface LineChartByInstanceProps {
  courseId: string
  data: Record<string, CountResult[]> | undefined
  isLoading: boolean
  error: Error | undefined | null
  period: Period
  setPeriod: React.Dispatch<React.SetStateAction<Period>>
  yAxisName: string
  tooltipValueLabel: string
  dateFormat: string
  statHeading: string
  instructionText: string
  disablePeriodSelector?: boolean
}

const AXIS = "axis"
const DATA_MAX = "dataMax"
const DATA_MIN = "dataMin"

const tooltipRow = css`
  display: flex;
  justify-content: space-between;
  margin: 3px 0;
  font-size: 14px;
`

const tooltipLabel = css`
  margin-right: 15px;
  display: flex;
  align-items: center;
`

const getTooltipDotStyle = (color: ZRColor | undefined) => css`
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 8px;
  background-color: ${typeof color === "object" ? "#000" : (color ?? "#000")};
`

const tooltipContainer = css`
  padding: 4px 8px;
  min-width: 200px;
`

const tooltipHeader = css`
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  font-weight: bold;
`

const tooltipValue = css`
  font-weight: bold;
`

const chartContainer = css`
  margin-bottom: 2rem;
  border: 3px solid ${baseTheme.colors.clear[200]};
  border-radius: 6px;
  padding: 1rem;
  min-height: ${DEFAULT_CHART_HEIGHT}px;
  display: flex;
  align-items: center;
  justify-content: center;
`

const headerContainer = css`
  display: flex;
  gap: 1rem;
  align-items: center;
`

const getLogScaleButtonStyles = (isLogScale: boolean) => css`
  padding: 0.15rem 0.4rem;
  border: 1px solid ${isLogScale ? baseTheme.colors.blue[600] : baseTheme.colors.clear[300]};
  border-radius: 12px;
  background: ${isLogScale ? baseTheme.colors.blue[600] : baseTheme.colors.clear[200]};
  cursor: pointer;
  font-size: 11px;
  color: ${isLogScale ? "white" : baseTheme.colors.gray[600]};
  transition: all 0.15s ease-in-out;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
  box-shadow: ${isLogScale ? "inset 0 1px 1px rgba(0,0,0,0.1)" : "none"};

  &:hover {
    background: ${isLogScale ? baseTheme.colors.blue[700] : baseTheme.colors.clear[300]};
    border-color: ${isLogScale ? baseTheme.colors.blue[700] : baseTheme.colors.clear[400]};
  }

  &:active {
    transform: scale(0.96);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.15);
  }
`

const periodSelect = css`
  margin-bottom: 0;
  min-width: 120px;
`

const LineChartByInstance: React.FC<LineChartByInstanceProps> = ({
  courseId,
  data,
  isLoading,
  error,
  period,
  setPeriod,
  yAxisName,
  tooltipValueLabel,
  dateFormat,
  statHeading,
  instructionText,
  disablePeriodSelector = false,
}) => {
  const { t } = useTranslation()
  const courseInstancesQuery = useCourseInstancesQuery(courseId)
  const [isLogScale, setIsLogScale] = useState(false)

  const instanceMap = useMemo(() => {
    if (!courseInstancesQuery.data) {
      return new Map()
    }
    return new Map(courseInstancesQuery.data.map((instance) => [instance.id, instance]))
  }, [courseInstancesQuery.data])

  const chartOptions: EChartsOption = useMemo(() => {
    if (!data) {
      return {}
    }

    const getInstanceName = (instanceId: string) => {
      const instance = instanceMap.get(instanceId)
      if (!instance) {
        return instanceId
      }
      return instance.name || t("default-instance")
    }

    // Get all unique dates across all instances
    const allDates = new Set<string>()
    Object.values(data).forEach((instanceData) => {
      instanceData.forEach((item) => {
        if (item.period) {
          try {
            allDates.add(format(new Date(item.period), dateFormat))
          } catch {
            allDates.add(item.period)
          }
        }
      })
    })

    const sortedDates = Array.from(allDates).sort()

    // Create series for each instance with their data
    const seriesWithData = Object.entries(data).map(([instanceId, instanceData]) => {
      const countByDate = new Map(
        instanceData.map((item) => {
          const date = item.period ? format(new Date(item.period), dateFormat) : ""
          return [date, item.count]
        }),
      )

      // When in log scale, replace zeros with null to create gaps in the line
      const values = sortedDates.map((date) => {
        const value = countByDate.get(date) || 0
        return isLogScale && value <= 0 ? null : value
      })

      // Find the last date with actual data (not a filled-in zero)
      let lastDataIndex = -1
      for (let i = 0; i < sortedDates.length; i++) {
        if (countByDate.has(sortedDates[i])) {
          lastDataIndex = i
        }
      }

      // If instance has data for the latest date, use that value for sorting
      // Otherwise, it should be ranked lower (use negative value as penalty)
      const isLatestDateMissing = lastDataIndex < sortedDates.length - 1
      const lastValue = lastDataIndex >= 0 ? values[lastDataIndex] : 0

      return {
        name: getInstanceName(instanceId),
        type: "line" as const,
        data: values,
        connectNulls: false, // Don't connect across null values
        sortValue: isLatestDateMissing ? -1 : lastValue, // Instances missing end data sorted last
        triggerLineEvent: true,
      }
    })

    // Sort series by sortValue in descending order, then alphabetically by name
    const series = seriesWithData
      .sort((a, b) => {
        // First compare by sortValue
        if (b.sortValue !== a.sortValue) {
          return (b.sortValue ?? -1) - (a.sortValue ?? -1)
        }
        // If sortValues are equal, sort alphabetically by name
        return a.name.localeCompare(b.name)
      })
      .map(({ name, type, data }) => ({ name, type, data }))

    return {
      color: [
        baseTheme.colors.blue[600],
        baseTheme.colors.green[400],
        baseTheme.colors.crimson[700],
        baseTheme.colors.yellow[400],
        baseTheme.colors.purple[600],
        baseTheme.colors.gray[400],
        "#5470c6",
        "#91cc75",
        "#fc8452",
        "#73c0de",
        "#3ba272",
        "#ea7ccc",
        "#2f4554",
        "#61a0a8",
        "#d48265",
        "#ca8622",
        "#bda29a",
        "#546570",
        "#f05b72",
        "#ef5b9c",
        "#9b8bba",
        "#4d7c8a",
        "#e66100",
        "#956065",
        "#5b8c5a",
        "#a65d57",
        "#4a639c",
        "#ce8d3e",
        "#806491",
        "#c17305",
      ],
      xAxis: {
        type: "category" as const,
        data: sortedDates,
      },
      yAxis: {
        name: yAxisName,
        scale: true,
        type: isLogScale ? "log" : "value",
        logBase: 10,
        minorTick: {
          show: false,
        },
        minorSplitLine: {
          show: false,
        },
        min: DATA_MIN,
        max: DATA_MAX,
      },
      series,
      tooltip: {
        trigger: AXIS,
        formatter: (params) => {
          if (!Array.isArray(params)) {
            throw new Error("Tooltip params is not an array")
          }
          const date = params[0].name
          const rows = params
            .map((p) => {
              const value = Math.round(Number(p.value ?? 0)).toLocaleString()
              // eslint-disable-next-line i18next/no-literal-string
              return `
                <div class="${tooltipRow}">
                  <span class="${tooltipLabel}">
                    <span class="${getTooltipDotStyle(p.color)}"></span>
                    ${p.seriesName}
                  </span>
                  <span class="${tooltipValue}">${value} ${tooltipValueLabel.toLocaleLowerCase()}</span>
                </div>`
            })
            .join("")

          // eslint-disable-next-line i18next/no-literal-string
          return `
            <div class="${tooltipContainer}">
              <div class="${tooltipHeader}">
                ${date}
              </div>
              ${rows}
            </div>`
        },
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        borderWidth: 0,
        shadowBlur: 10,
        shadowColor: "rgba(0, 0, 0, 0.2)",
        shadowOffsetX: 1,
        shadowOffsetY: 2,
        textStyle: {
          color: "#333",
        },
        padding: 0,
      },
      legend: {
        type: "scroll" as const,
        // eslint-disable-next-line i18next/no-literal-string
        orient: "horizontal" as const,
        bottom: 0,
      },
    }
  }, [data, yAxisName, isLogScale, instanceMap, t, dateFormat, tooltipValueLabel])

  const isDataEmpty =
    !data || Object.keys(data).length === 0 || Object.values(data).every((arr) => arr.length < 2)

  return (
    <>
      <StatsHeader heading={statHeading} debugData={data}>
        <div className={headerContainer}>
          <button
            onClick={() => setIsLogScale(!isLogScale)}
            className={getLogScaleButtonStyles(isLogScale)}
          >
            {t("log-scale-short")}
          </button>
          {!disablePeriodSelector && (
            <SelectMenu
              id="period-select"
              options={[
                { value: MONTHLY_PERIOD, label: t("stats-period-monthly") },
                { value: DAILY_PERIOD, label: t("stats-period-daily") },
              ]}
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className={periodSelect}
              showDefaultOption={false}
            />
          )}
        </div>
      </StatsHeader>
      <InstructionBox>{instructionText}</InstructionBox>
      <div className={chartContainer}>
        {isLoading || courseInstancesQuery.isLoading ? (
          <Spinner variant="medium" />
        ) : error || courseInstancesQuery.error ? (
          <ErrorBanner variant="readOnly" error={error || courseInstancesQuery.error} />
        ) : isDataEmpty ? (
          <div>{t("no-data")}</div>
        ) : (
          <Echarts options={chartOptions} height={DEFAULT_CHART_HEIGHT} />
        )}
      </div>
    </>
  )
}

export default LineChartByInstance
