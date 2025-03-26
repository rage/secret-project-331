import { css } from "@emotion/css"
import { format } from "date-fns"
import type { EChartsOption } from "echarts/types/src/export/option"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { InstructionBox } from "./CourseStatsPage"
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
      return instance?.name || t("default-instance")
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

      const values = sortedDates.map((date) => countByDate.get(date) || 0)

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
        sortValue: isLatestDateMissing ? -1 : lastValue, // Instances missing end data sorted last
      }
    })

    // Sort series by sortValue in descending order, then alphabetically by name
    const series = seriesWithData
      .sort((a, b) => {
        // First compare by sortValue
        if (b.sortValue !== a.sortValue) {
          return b.sortValue - a.sortValue
        }
        // If sortValues are equal, sort alphabetically by name
        return a.name.localeCompare(b.name)
      })
      .map(({ name, type, data }) => ({ name, type, data }))

    return {
      xAxis: {
        type: "category" as const,
        data: sortedDates,
      },
      yAxis: {
        type: "value" as const,
        name: yAxisName,
      },
      series,
      tooltip: {
        // eslint-disable-next-line i18next/no-literal-string
        trigger: "axis" as const,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (params: any) => {
          const date = params[0].name
          const rows = params
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((p: any) => `${p.seriesName}: ${tooltipValueLabel}: ${p.value}`)
            // eslint-disable-next-line i18next/no-literal-string
            .join("<br/>")
          // eslint-disable-next-line i18next/no-literal-string
          return `${date}<br/>${rows}`
        },
      },
      legend: {
        type: "scroll" as const,
        // eslint-disable-next-line i18next/no-literal-string
        orient: "horizontal" as const,
        bottom: 0,
      },
    }
  }, [data, yAxisName, instanceMap, t, dateFormat, tooltipValueLabel])

  const isDataEmpty =
    !data || Object.keys(data).length === 0 || Object.values(data).every((arr) => arr.length < 2)

  return (
    <>
      <StatsHeader heading={statHeading} debugData={data}>
        {!disablePeriodSelector && (
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
          min-height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
        `}
      >
        {isLoading || courseInstancesQuery.isLoading ? (
          <Spinner variant="medium" />
        ) : error || courseInstancesQuery.error ? (
          <ErrorBanner variant="readOnly" error={error || courseInstancesQuery.error} />
        ) : isDataEmpty ? (
          <div>{t("no-data")}</div>
        ) : (
          <Echarts options={chartOptions} height={300} />
        )}
      </div>
    </>
  )
}

export default LineChartByInstance
