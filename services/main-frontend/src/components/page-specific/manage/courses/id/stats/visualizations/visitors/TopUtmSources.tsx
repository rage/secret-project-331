import { css } from "@emotion/css"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { InstructionBox } from "../../CourseStatsPage"
import Echarts from "../../Echarts"
import StatsHeader from "../../StatsHeader"

import useCoursePageVisitDatumSummary from "@/hooks/useCoursePageVisitDatumSummary"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export interface TopUTMSourcesProps {
  courseId: string
}

const DEFAULT_CHART_HEIGHT = 300

const containerStyles = css`
  margin-bottom: 2rem;
  border: 3px solid ${baseTheme.colors.clear[200]};
  border-radius: 6px;
  padding: 1rem;
  min-height: ${DEFAULT_CHART_HEIGHT}px;
  display: flex;
  align-items: center;
  justify-content: center;
`

const TopUTMSources: React.FC<React.PropsWithChildren<TopUTMSourcesProps>> = ({ courseId }) => {
  const { t } = useTranslation()
  const query = useCoursePageVisitDatumSummary(courseId)

  const aggregatedData = useMemo(() => {
    if (!query.data || query.data.length === 0) {
      return null
    }
    const allUtmSourcesInData = Array.from(
      new Set(query.data.map((item) => item.utm_source)),
    ).filter((item) => !!item)
    const totalCountsByUTMSource: { [referrer: string]: number } = Array.from(
      allUtmSourcesInData,
    ).reduce((acc, utm_source) => {
      const totalCount = query.data
        .filter((item) => item.utm_source === utm_source)
        .reduce((acc, item) => acc + item.num_visitors, 0)
      // eslint-disable-next-line i18next/no-literal-string
      return { ...acc, [utm_source ?? "null"]: totalCount }
    }, {})
    return totalCountsByUTMSource
  }, [query.data])

  const categories = useMemo(() => {
    if (!aggregatedData) {
      return []
    }
    return Object.keys(aggregatedData)
  }, [aggregatedData])
  const values = useMemo(() => {
    if (!aggregatedData) {
      return []
    }
    return Object.values(aggregatedData)
  }, [aggregatedData])

  const chartHeight = categories.length ? 200 + categories.length * 25 : DEFAULT_CHART_HEIGHT

  return (
    <>
      <StatsHeader heading={t("header-utm-sources")} debugData={aggregatedData} />
      <InstructionBox>{t("stats-instruction-utm-sources")}</InstructionBox>
      <div className={containerStyles}>
        {query.isPending ? (
          <Spinner variant="medium" />
        ) : query.isError ? (
          <ErrorBanner variant="readOnly" error={query.error} />
        ) : !aggregatedData || categories.length === 0 ? (
          <div>{t("no-data")}</div>
        ) : (
          <div
            className={css`
              width: 100%;
            `}
          >
            <Echarts
              height={chartHeight}
              options={{
                grid: {
                  containLabel: true,
                  left: 0,
                },
                yAxis: {
                  type: "category",
                  data: categories,
                },
                xAxis: {
                  type: "value",
                },
                series: [
                  {
                    data: values,
                    type: "bar",
                  },
                ],
                tooltip: {
                  // eslint-disable-next-line i18next/no-literal-string
                  trigger: "item",
                  // eslint-disable-next-line i18next/no-literal-string
                  formatter: "{b}: {c}",
                },
              }}
            />
          </div>
        )}
      </div>
    </>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(TopUTMSources))
