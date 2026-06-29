"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { groupBy, max } from "lodash"
import React from "react"
import { useTranslation } from "react-i18next"

import Echarts from "../../Echarts"
import StatsHeader from "../../StatsHeader"
import NoDataMessage from "../NoDataMessage"

import { getCourseDailyUsersWhoSubmittedSomethingOptions } from "@/generated/api/@tanstack/react-query.generated"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"

export interface CourseUsersWithSubmissionsByDayProps {
  courseId: string
}

const CourseUsersWithSubmissionsByDay: React.FC<
  React.PropsWithChildren<CourseUsersWithSubmissionsByDayProps>
> = ({ courseId }) => {
  const { t } = useTranslation()
  const query = useQuery({
    ...getCourseDailyUsersWhoSubmittedSomethingOptions({
      path: {
        course_id: courseId,
      },
    }),
  })

  return (
    <>
      <StatsHeader
        heading={t("stats-heading-users-with-submissions-by-day")}
        debugData={query.data}
      />

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
          min-height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
        `}
      >
        <QueryResult query={query} emptyFallback={<NoDataMessage />}>
          {(data) => {
            const eChartsData = groupBy(data, (o) => {
              const dateString = o.date as string | null
              const year = dateString?.substring(0, dateString.indexOf("-"))
              return year
            })
            const maxValue = max(data.map((o) => o.count)) || 10000
            return (
              <div
                className={css`
                  width: 100%;
                `}
              >
                <Echarts
                  height={200 * Object.keys(eChartsData).length}
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
                      max: maxValue,
                    },
                    calendar: Object.entries(eChartsData).map(([year, _submissionCounts], i) => {
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
                    series: Object.entries(eChartsData).map(([_year, submissionCounts], i) => {
                      return {
                        type: "heatmap",
                        // eslint-disable-next-line i18next/no-literal-string
                        coordinateSystem: "calendar",
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        data: (submissionCounts as any[]).map((o) => [o.date, o.count]),
                        calendarIndex: i,
                      }
                    }),
                  }}
                />
              </div>
            )
          }}
        </QueryResult>
      </div>
    </>
  )
}

export default withErrorBoundary(CourseUsersWithSubmissionsByDay)
