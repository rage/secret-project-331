import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { InstructionBox } from "../../CourseStatsPage"
import Echarts from "../../Echarts"
import StatsHeader from "../../StatsHeader"

import { fetchStudentsByCountryTotals } from "@/services/backend/courses/stats"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface Props {
  courseId: string
}

const StudentsByCountryTotals: React.FC<Props> = ({ courseId }) => {
  const { t } = useTranslation()

  const query = useQuery({
    queryKey: ["students-by-country-totals", courseId],
    queryFn: () => fetchStudentsByCountryTotals(courseId),
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
          count: countryData.reduce((acc, d) => acc + d.count, 0),
        }
      })
      .sort((a, b) => a.count - b.count)
    if (totalCountsByCountry.length > 15) {
      totalCountsByCountry = totalCountsByCountry.filter((d) => d.count >= 10)
    }
    const totalCountsByCountryObject = totalCountsByCountry.reduce(
      (acc, d) => {
        // eslint-disable-next-line i18next/no-literal-string
        acc[d.country ?? "null"] = d.count
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

  const chartHeight = categories.length ? 200 + categories.length * 25 : 300
  return (
    <>
      <StatsHeader heading={t("students-by-chosen-country")} debugData={aggregatedData} />
      <InstructionBox>{t("stats-instruction-users-by-country")}</InstructionBox>

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
        {query.isLoading ? (
          <Spinner variant="medium" />
        ) : query.isError ? (
          <ErrorBanner variant="readOnly" error={query.error} />
        ) : !aggregatedData || categories.length === 0 ? (
          <div>{t("no-data")}</div>
        ) : (
          <Echarts
            height={chartHeight}
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
                  type: "bar",
                  data: values,
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
      </div>
    </>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(StudentsByCountryTotals))
