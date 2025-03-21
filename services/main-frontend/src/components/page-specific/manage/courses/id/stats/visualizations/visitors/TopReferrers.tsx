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

export interface TopReferrersProps {
  courseId: string
}

const TopReferrers: React.FC<React.PropsWithChildren<TopReferrersProps>> = ({ courseId }) => {
  const { t } = useTranslation()
  const query = useCoursePageVisitDatumSummary(courseId)

  const aggregatedData = useMemo(() => {
    if (!query.data || query.data.length === 0) {
      return null
    }
    const allReferrersInData = Array.from(new Set(query.data.map((item) => item.referrer))).filter(
      (item) => !!item,
    )
    const totalCountsByReferrer: { referrer: string; visitors: number }[] = Array.from(
      allReferrersInData,
    )
      .map((referrer) => {
        const totalCount = query.data
          .filter((item) => item.referrer === referrer)
          .reduce((acc, item) => acc + item.num_visitors, 0)
        // eslint-disable-next-line i18next/no-literal-string
        return { referrer: referrer ?? "null", visitors: totalCount }
      })
      .sort((a, b) => a.visitors - b.visitors)
    const totalCountsByReferrerObject: { [referrer: string]: number } =
      totalCountsByReferrer.reduce(
        (acc, d) => {
          // eslint-disable-next-line i18next/no-literal-string
          acc[d.referrer ?? "null"] = d.visitors
          return acc
        },
        {} as Record<string, number>,
      )
    return totalCountsByReferrerObject
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
    return <ErrorBanner variant="readOnly" error={query.error} />
  }

  if (query.isPending || !query.data) {
    return <Spinner variant="medium" />
  }

  return (
    <>
      <StatsHeader heading={t("stats-heading-referrers")} debugData={aggregatedData} />
      <InstructionBox>{t("stats-instruction-referrers")}</InstructionBox>
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
    </>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(TopReferrers))
