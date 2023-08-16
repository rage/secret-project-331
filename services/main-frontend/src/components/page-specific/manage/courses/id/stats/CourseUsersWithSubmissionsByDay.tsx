import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { groupBy, max } from "lodash"
import React from "react"
import { useTranslation } from "react-i18next"

import { fetchCourseDailyUserCountsWithSubmissions } from "../../../../../../services/backend/courses"
import DebugModal from "../../../../../../shared-module/components/DebugModal"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"
import { baseTheme } from "../../../../../../shared-module/styles"
import { dontRenderUntilQueryParametersReady } from "../../../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../../../shared-module/utils/withErrorBoundary"

import Echarts from "./Echarts"

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

  if (getCourseDailySubmissionCounts.isLoading) {
    return <Spinner variant={"medium"} />
  }

  if (getCourseDailySubmissionCounts.data.apiData.length === 0) {
    return <div>{t("no-data")}</div>
  }

  return (
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
                // eslint-disable-next-line i18next/no-literal-string
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
  )
}

export default withErrorBoundary(
  dontRenderUntilQueryParametersReady(CourseUsersWithSubmissionsByDay),
)
