import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useMemo } from "react"

import { useCourseStructure } from "../../../../../../hooks/useCourseStructure"
import { fetchCoursePageVisitDatumSummaryByPages } from "../../../../../../services/backend/courses"
import DebugModal from "../../../../../../shared-module/components/DebugModal"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"
import { baseTheme } from "../../../../../../shared-module/styles"
import { dontRenderUntilQueryParametersReady } from "../../../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../../../shared-module/utils/withErrorBoundary"

import Echarts from "./Echarts"

export interface CourseVisitorsByCountryProps {
  courseId: string
}

const CourseVisitorsByCountry: React.FC<React.PropsWithChildren<CourseVisitorsByCountryProps>> = ({
  courseId,
}) => {
  const query = useQuery({
    queryKey: [`course-page-visit-datum-summary-by-pages-${courseId}`],
    queryFn: () => fetchCoursePageVisitDatumSummaryByPages(courseId),
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
    const topPages: { [page_id: string]: number } = totalCountsByPage
      .slice(-100)
      .reduce((acc, curr) => {
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

  if (query.isError) {
    return <ErrorBanner variant="readOnly" error={query.error} />
  }

  if (query.isLoading || !query.data || courseStructure.isLoading) {
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
                trigger: "item",
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

export default withErrorBoundary(dontRenderUntilQueryParametersReady(CourseVisitorsByCountry))
