import { css } from "@emotion/css"
import { max } from "lodash"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { InstructionBox } from "../../CourseStatsPage"
import Echarts from "../../Echarts"
import StatsHeader from "../../StatsHeader"

import useCoursePageVisitDatumSummary from "@/hooks/useCoursePageVisitDatumSummary"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export interface CourseVisitorsByDayProps {
  courseId: string
}

const CourseVisitorsByDay: React.FC<React.PropsWithChildren<CourseVisitorsByDayProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const query = useCoursePageVisitDatumSummary(courseId)

  const data = useMemo(() => {
    if (!query.data) {
      return null
    }
    const allDates = new Set(query.data.map((o) => o.visit_date))

    // Total by date
    const totalByDate: { [date: string]: number } = Array.from(allDates).reduce((acc, date) => {
      const count = query.data.filter((o) => o.visit_date === date).length
      return { ...acc, [date]: count }
    }, {})
    // group totalByDate by year
    const totalByYear: { [year: string]: { date: string; count: number }[] } = Object.entries(
      totalByDate,
    ).reduce((acc, [date, count]) => {
      const year = new Date(date).getFullYear()
      return {
        ...acc,
        // @ts-expect-error: should be indexable
        [year]: [...(acc[year.toString()] || []), { date, count }],
      }
    }, {})

    return totalByYear
  }, [query.data])

  const maxValue = useMemo(() => {
    if (!data) {
      return 0
    }
    return max(Object.values(data).map((o) => max(o.map((o) => o.count)))) ?? 0
  }, [data])

  return (
    <>
      <StatsHeader heading={t("stats-heading-visitor-metrics")} debugData={data} />
      <InstructionBox>{t("stats-instruction-visitor-metrics")}</InstructionBox>
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
        ) : !data || query.data.length === 0 ? (
          <div>{t("no-data")}</div>
        ) : (
          <Echarts
            height={200 * Object.keys(data).length}
            options={{
              tooltip: {
                // eslint-disable-next-line i18next/no-literal-string
                trigger: "item",
                // eslint-disable-next-line i18next/no-literal-string
                formatter: "{b}: {c}",
              },
              visualMap: {
                show: false,
                min: 0,
                max: maxValue,
              },
              calendar: Object.entries(data).map(([year, _visitCounts], i) => {
                return {
                  range: year,
                  // eslint-disable-next-line i18next/no-literal-string
                  cellSize: ["auto", 20],
                  dayLabel: {
                    firstDay: 1,
                  },
                  top: 190 * i + 40,
                }
              }),
              series: Object.entries(data).map(([_year, visitCounts], i) => {
                return {
                  type: "heatmap",
                  // eslint-disable-next-line i18next/no-literal-string
                  coordinateSystem: "calendar",
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  data: (visitCounts as any[]).map((o) => [o.date, o.count]),
                  calendarIndex: i,
                }
              }),
            }}
          />
        )}
      </div>
    </>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(CourseVisitorsByDay))
