import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { groupBy, max } from "lodash"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { InstructionBox } from "../../CourseStatsPage"
import Echarts from "../../Echarts"
import StatsHeader from "../../StatsHeader"

import { fetchCourseDailySubmissionCounts } from "@/services/backend/courses"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export interface CourseSubmissionsByDayProps {
  courseId: string
}

const CourseSubmissionsByDay: React.FC<React.PropsWithChildren<CourseSubmissionsByDayProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: [`course-daily-submission-counts-${courseId}`],
    queryFn: () => fetchCourseDailySubmissionCounts(courseId),
  })

  const processedData = useMemo(() => {
    if (!query.data) {
      return null
    }

    const eChartsData = groupBy(query.data, (o) => {
      const dateString = o.date as string | null
      const year = dateString?.substring(0, dateString.indexOf("-"))
      return year
    })
    const maxValue = max(query.data.map((o) => o.count)) || 10000
    return { apiData: query.data, eChartsData, maxValue }
  }, [query.data])

  return (
    <>
      <StatsHeader heading={t("stats-heading-daily-submissions")} debugData={query.data} />
      <InstructionBox>{t("stats-instruction-daily-submissions")}</InstructionBox>
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
        {query.isPending ? (
          <Spinner variant="medium" />
        ) : query.isError ? (
          <ErrorBanner variant="readOnly" error={query.error} />
        ) : !processedData || processedData.apiData.length === 0 ? (
          <div>{t("no-data")}</div>
        ) : (
          <Echarts
            height={200 * Object.keys(processedData.eChartsData).length}
            options={{
              tooltip: {
                // eslint-disable-next-line i18next/no-literal-string
                position: "top",
                formatter: (a) => {
                  return t("daily-submissions-visualization-tooltip", {
                    // @ts-expect-error: todo
                    day: a.data[0],
                    // @ts-expect-error: todo
                    submissions: a.data[1],
                  })
                },
              },
              visualMap: {
                show: false,
                min: 0,
                max: processedData.maxValue,
              },
              calendar: Object.entries(processedData.eChartsData).map(
                ([year, _submissionCounts], i) => {
                  return {
                    range: year,
                    // eslint-disable-next-line i18next/no-literal-string
                    cellSize: ["auto", 20],
                    dayLabel: {
                      firstDay: 1,
                    },
                    top: 190 * i + 40,
                  }
                },
              ),
              series: Object.entries(processedData.eChartsData).map(
                ([_year, submissionCounts], i) => {
                  return {
                    type: "heatmap",
                    // eslint-disable-next-line i18next/no-literal-string
                    coordinateSystem: "calendar",
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    data: (submissionCounts as any[]).map((o) => [o.date, o.count]),
                    calendarIndex: i,
                  }
                },
              ),
            }}
          />
        )}
      </div>
    </>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(CourseSubmissionsByDay))
