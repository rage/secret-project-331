import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { groupBy, max } from "lodash"
import React from "react"
import { useTranslation } from "react-i18next"

import Echarts from "../../Echarts"

import { fetchCourseDailyUserCountsWithSubmissions } from "@/services/backend/courses"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export interface CourseUsersWithSubmissionsByDayProps {
  courseId: string
}

const CourseUsersWithSubmissionsByDay: React.FC<
  React.PropsWithChildren<CourseUsersWithSubmissionsByDayProps>
> = ({ courseId }) => {
  const { t } = useTranslation()
  const getCourseDailySubmissionCounts = useQuery({
    queryKey: [`course-daily-users-count-with-submissionss`, courseId],
    queryFn: () => fetchCourseDailyUserCountsWithSubmissions(courseId),
    select: (data) => {
      const eChartsData = groupBy(data, (o) => {
        const dateString = o.date as string | null
        const year = dateString?.substring(0, dateString.indexOf("-"))
        return year
      })
      const maxValue = max(data.map((o) => o.count)) || 10000
      return { apiData: data, eChartsData, maxValue }
    },
  })

  if (getCourseDailySubmissionCounts.isError) {
    return <ErrorBanner variant={"readOnly"} error={getCourseDailySubmissionCounts.error} />
  }

  if (getCourseDailySubmissionCounts.isPending) {
    return <Spinner variant={"medium"} />
  }

  if (getCourseDailySubmissionCounts.data.apiData.length === 0) {
    return <div>{t("no-data")}</div>
  }

  return (
    <>
      <h2
        className={css`
          font-size: 1.8rem;
          color: ${baseTheme.colors.gray[600]};
          font-family: ${headingFont};
          margin-bottom: 1rem;
          margin-top: 1rem;
        `}
      >
        {t("stats-heading-users-with-submissions-by-day")}
      </h2>

      <div
        className={css`
          background-color: ${baseTheme.colors.clear[100]};
          border-left: 4px solid ${baseTheme.colors.blue[600]};
          padding: 1rem;
          margin-bottom: 2rem;
          border-radius: 4px;
          color: ${baseTheme.colors.gray[600]};
          font-size: 0.9rem;
          line-height: 1.5;
        `}
      >
        {t("stats-instruction-users-with-submissions")}
      </div>

      <div
        className={css`
          margin-bottom: 2rem;
          border: 3px solid ${baseTheme.colors.clear[200]};
          border-radius: 6px;
          padding: 1rem;
        `}
      >
        <Echarts
          height={200 * Object.keys(getCourseDailySubmissionCounts.data.eChartsData).length}
          options={{
            tooltip: {
              // eslint-disable-next-line i18next/no-literal-string
              position: "top",
              formatter: (a) => {
                return t("daily-users-with-submissions-visualization-tooltip", {
                  // @ts-expect-error: todo
                  day: a.data[0],
                  // @ts-expect-error: todo
                  users: a.data[1],
                })
              },
            },
            visualMap: {
              show: false,
              min: 0,
              max: getCourseDailySubmissionCounts.data.maxValue,
            },
            calendar: Object.entries(getCourseDailySubmissionCounts.data.eChartsData).map(
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
            series: Object.entries(getCourseDailySubmissionCounts.data.eChartsData).map(
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
        <DebugModal data={getCourseDailySubmissionCounts.data.apiData} />
      </div>
    </>
  )
}

export default withErrorBoundary(
  dontRenderUntilQueryParametersReady(CourseUsersWithSubmissionsByDay),
)
