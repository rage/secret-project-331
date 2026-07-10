"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { DEFAULT_CHART_HEIGHT, InstructionBox } from "../../CourseStatsPage"
import Echarts from "../../Echarts"
import StatsHeader from "../../StatsHeader"
import NoDataMessage from "../NoDataMessage"

import { getCoursePageVisitDatumSummaryByPagesOptions } from "@/generated/api/@tanstack/react-query.generated"
import { useCourseStructure } from "@/hooks/useCourseStructure"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResults } from "@/shared-module/components"

export interface MostVisitedPagesProps {
  courseId: string
}

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

const MostVisitedPages: React.FC<React.PropsWithChildren<MostVisitedPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const query = useQuery({
    ...getCoursePageVisitDatumSummaryByPagesOptions({
      path: {
        course_id: courseId,
      },
    }),
  })

  const courseStructure = useCourseStructure(courseId)

  const aggregatedData = useMemo(() => {
    if (!query.data || query.data.length === 0) {
      return null
    }
    const allPageIdsInData = Array.from(new Set(query.data.map((obj) => obj.page_id)))
    const totalCountsByPage = Array.from(allPageIdsInData)
      .map((pageId) => {
        const pageData = query.data.filter((item) => item.page_id === pageId)
        return {
          page_id: pageId,
          total: pageData.reduce((acc, curr) => acc + curr.num_visitors, 0),
        }
      })
      .sort((a, b) => a.total - b.total)
    const topPages: Record<string, number> = totalCountsByPage.slice(-100).reduce((acc, curr) => {
      return {
        ...acc,
        [curr.page_id]: curr.total,
      }
    }, {})
    return topPages
  }, [query.data])

  const categories = useMemo(() => {
    if (!aggregatedData) {
      return []
    }
    return Object.keys(aggregatedData).map((pageId) => {
      return courseStructure.data?.pages.find((page) => page.id === pageId)?.url_path ?? pageId
    })
  }, [aggregatedData, courseStructure.data?.pages])
  const values = useMemo(() => {
    if (!aggregatedData) {
      return []
    }
    return Object.values(aggregatedData)
  }, [aggregatedData])

  const chartHeight = categories.length ? 200 + categories.length * 25 : DEFAULT_CHART_HEIGHT

  return (
    <>
      <StatsHeader heading={t("stats-heading-page-popularity")} debugData={aggregatedData} />
      <InstructionBox>{t("stats-instruction-page-popularity")}</InstructionBox>
      <div className={containerStyles}>
        <QueryResults
          queries={[query, courseStructure] as const}
          emptyFallback={<NoDataMessage />}
          renderData={() =>
            !aggregatedData || categories.length === 0 ? (
              <NoDataMessage />
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
                      // oxlint-disable-next-line i18next/no-literal-string
                      trigger: "item",
                      // oxlint-disable-next-line i18next/no-literal-string
                      formatter: "{b}: {c}",
                    },
                  }}
                />
              </div>
            )
          }
        />
      </div>
    </>
  )
}

export default withErrorBoundary(MostVisitedPages)
