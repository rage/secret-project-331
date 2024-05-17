import { css } from "@emotion/css"
import React, { useMemo } from "react"

import useCoursePageVisitDatumSummary from "../../../../../../hooks/useCoursePageVisitDatumSummary"
import DebugModal from "../../../../../../shared-module/common/components/DebugModal"
import ErrorBanner from "../../../../../../shared-module/common/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/common/components/Spinner"
import { baseTheme } from "../../../../../../shared-module/common/styles"
import { dontRenderUntilQueryParametersReady } from "../../../../../../shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../../../shared-module/common/utils/withErrorBoundary"

import Echarts from "./Echarts"

export interface TopUTMCampaignsProps {
  courseId: string
}

const TopUTMCampaigns: React.FC<React.PropsWithChildren<TopUTMCampaignsProps>> = ({ courseId }) => {
  const query = useCoursePageVisitDatumSummary(courseId)

  const aggregatedData = useMemo(() => {
    if (!query.data || query.data.length === 0) {
      return null
    }
    const allUtmCampaignsInData = Array.from(
      new Set(query.data.map((item) => item.utm_campaign)),
    ).filter((item) => !!item)
    const totalCountsByUTMCampaign: { [referrer: string]: number } = Array.from(
      allUtmCampaignsInData,
    ).reduce((acc, utm_campaign) => {
      const totalCount = query.data
        .filter((item) => item.utm_campaign === utm_campaign)
        .reduce((acc, item) => acc + item.num_visitors, 0)
      // eslint-disable-next-line i18next/no-literal-string
      return { ...acc, [utm_campaign ?? "null"]: totalCount }
    }, {})
    return totalCountsByUTMCampaign
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

  if (query.isError) {
    return <ErrorBanner error={query.error} />
  }

  if (query.isPending || !query.data) {
    return <Spinner variant="medium" />
  }

  return (
    <div
      className={css`
        margin-bottom: 2rem;
      `}
    >
      <div
        className={css`
          margin-bottom: 1.5rem;
          border: 3px solid ${baseTheme.colors.clear[200]};
          border-radius: 6px;
          padding: 1rem;
        `}
      >
        {aggregatedData && (
          <Echarts
            height={200 + categories.length * 25}
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
        )}
        <DebugModal data={aggregatedData} />
      </div>
    </div>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(TopUTMCampaigns))
