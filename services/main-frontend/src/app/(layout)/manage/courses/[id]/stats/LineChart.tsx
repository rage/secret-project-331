"use client"

import { css } from "@emotion/css"
import { format } from "date-fns"
import type { EChartsOption, TooltipComponentFormatterCallbackParams } from "echarts"
import React, { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"

import Echarts from "@/components/charts/Echarts"
import type { CountResult } from "@/generated/api/types.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import SelectMenu from "@/shared-module/common/components/SelectMenu"
import { baseTheme } from "@/shared-module/common/styles"
import { LoadingRegion } from "@/shared-module/components"
import { DateField } from "@/shared-module/components/components/DateField"

import { DEFAULT_CHART_HEIGHT, InstructionBox } from "./CourseStatsPage"
import StatsHeader from "./StatsHeader"

export const MONTHLY_PERIOD = "Month" as const
export const DAILY_PERIOD = "Day" as const
export const CUSTOM_PERIOD = "Custom" as const

export type Period = typeof MONTHLY_PERIOD | typeof DAILY_PERIOD | typeof CUSTOM_PERIOD

export const DAILY_DATE_FORMAT = "yyyy-MM-dd"
export const MONTHLY_DATE_FORMAT = "yyyy-MM"

interface CustomDateRangeFilterValues {
  startDate: string
  endDate: string
}

interface LineChartProps {
  data: CountResult[] | undefined
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
  showCustomTimePeriodSelector?: boolean
  startDate?: string | null
  endDate?: string | null
  setStartDate?: React.Dispatch<React.SetStateAction<string | null>>
  setEndDate?: React.Dispatch<React.SetStateAction<string | null>>
}

const LineChart: React.FC<LineChartProps> = ({
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
  showCustomTimePeriodSelector,
  setStartDate,
  setEndDate,
}) => {
  const { t } = useTranslation()

  // DateField is control/name-only (no onChange prop), so this local form exists solely to host it;
  // its values are mirrored up through the legacy setStartDate/setEndDate callback props.
  const { control: dateRangeControl } = useForm<CustomDateRangeFilterValues>({
    defaultValues: { startDate: "", endDate: "" },
  })
  const watchedStartDate = useWatch({ control: dateRangeControl, name: "startDate" })
  const watchedEndDate = useWatch({ control: dateRangeControl, name: "endDate" })

  useEffect(() => {
    setStartDate?.(watchedStartDate || null)
  }, [watchedStartDate, setStartDate])

  useEffect(() => {
    setEndDate?.(watchedEndDate || null)
  }, [watchedEndDate, setEndDate])

  const chartOptions: EChartsOption = {
    xAxis: {
      type: "category" as const,
      data:
        data
          ?.map((item) => {
            if (!item.period) {
              return null
            }
            try {
              return format(new Date(item.period), dateFormat)
            } catch {
              return item.period
            }
          })
          .filter((x): x is string => x !== null) || [],
    },
    yAxis: {
      type: "value" as const,
      name: yAxisName,
    },
    series: [
      {
        data: data?.map((item) => item.count) || [],
        type: "line" as const,
      },
    ],
    tooltip: {
      // oxlint-disable-next-line i18next/no-literal-string
      trigger: "axis" as const,
      formatter: (params: TooltipComponentFormatterCallbackParams) => {
        if (!Array.isArray(params) || !params[0]) {
          return ""
        }
        const dataIndex = params[0].dataIndex as number
        const dataPeriod = data?.[dataIndex]?.period
        const value = data?.[dataIndex]?.count
        try {
          const formattedDate = format(new Date(dataPeriod || ""), dateFormat)
          // oxlint-disable-next-line i18next/no-literal-string
          return `${formattedDate}<br/>${tooltipValueLabel}: ${value}`
        } catch {
          // oxlint-disable-next-line i18next/no-literal-string
          return `${dataPeriod}<br/>${tooltipValueLabel}: ${value}`
        }
      },
    },
  }

  return (
    <>
      <StatsHeader heading={statHeading} debugData={data}>
        {!disablePeriodSelector && (
          <div
            className={css`
              display: flex;
              gap: 1rem;
              align-items: center;
            `}
          >
            {showCustomTimePeriodSelector && period === CUSTOM_PERIOD && (
              <div
                className={css`
                  display: flex;
                  gap: 4px;
                  padding-bottom: 12px;
                `}
              >
                <DateField
                  control={dateRangeControl}
                  name="startDate"
                  label={t("stats-start-date")}
                />
                <DateField control={dateRangeControl} name="endDate" label={t("stats-end-date")} />
              </div>
            )}

            <SelectMenu
              id="period-select"
              options={[
                { value: MONTHLY_PERIOD, label: t("stats-period-monthly") },
                { value: DAILY_PERIOD, label: t("stats-period-daily") },
                ...(showCustomTimePeriodSelector
                  ? [{ value: CUSTOM_PERIOD, label: t("stats-period-custom") }]
                  : []),
              ]}
              value={period}
              onChange={(e) => setPeriod(e.currentTarget.value as Period)}
              className={css`
                margin-bottom: 0;
                min-width: 120px;
              `}
              showDefaultOption={false}
            />
          </div>
        )}
      </StatsHeader>
      <InstructionBox>{instructionText}</InstructionBox>
      <div
        className={css`
          margin-bottom: 2rem;
          border: 3px solid ${baseTheme.colors.clear[200]};
          border-radius: 6px;
          padding: 1rem;
          min-height: ${DEFAULT_CHART_HEIGHT}px;
          display: flex;
          align-items: center;
          justify-content: center;
        `}
      >
        {isLoading ? (
          <LoadingRegion minHeight={0} />
        ) : error ? (
          <ErrorBanner variant="readOnly" error={error} />
        ) : !data || data.length < 2 ? (
          <div>{t("no-data")}</div>
        ) : (
          <Echarts options={chartOptions} height={DEFAULT_CHART_HEIGHT} />
        )}
      </div>
    </>
  )
}

export default LineChart
