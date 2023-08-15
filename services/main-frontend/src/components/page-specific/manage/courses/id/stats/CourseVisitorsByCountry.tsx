import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useMemo } from "react"

import { fetchCoursePageVisitDatumSummariesByCountry } from "../../../../../../services/backend/courses"
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
    queryKey: [`course-page-visit-datum-summary-by-country${courseId}`],
    queryFn: () => fetchCoursePageVisitDatumSummariesByCountry(courseId),
  })

  const aggregatedData = useMemo(() => {
    if (!query.data || query.data.length === 0) {
      return null
    }
    const allCountriesInData = new Set(query.data.map((d) => d.country))
    let totalCountsByCountry = Array.from(allCountriesInData)
      .map((country) => {
        const countryData = query.data.filter((d) => d.country === country)
        return {
          country,
          num_visitors: countryData.reduce((acc, d) => acc + d.num_visitors, 0),
        }
      })
      .sort((a, b) => a.num_visitors - b.num_visitors)
    if (totalCountsByCountry.length > 15) {
      totalCountsByCountry = totalCountsByCountry.filter((d) => d.num_visitors >= 10)
    }
    const totalCountsByCountryObject = totalCountsByCountry.reduce(
      (acc, d) => {
        acc[d.country ?? "null"] = d.num_visitors
        return acc
      },
      {} as Record<string, number>,
    )
    return totalCountsByCountryObject
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

  if (query.isLoading || !query.data) {
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
