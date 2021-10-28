import { css } from "@emotion/css"
import { groupBy, max } from "lodash"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchCourseDailySubmissionCounts } from "../../services/backend/courses"
import DebugModal from "../../shared-module/components/DebugModal"
import { dontRenderUntilQueryParametersReady } from "../../shared-module/utils/dontRenderUntilQueryParametersReady"
import Echarts from "../Echarts"

export interface CourseSubmissionsByDayProps {
  courseId: string
}

const CourseSubmissionsByDay: React.FC<CourseSubmissionsByDayProps> = ({ courseId }) => {
  const { t } = useTranslation()
  const { isLoading, error, data } = useQuery(`course-daily-submission-counts-${courseId}`, () =>
    fetchCourseDailySubmissionCounts(courseId),
  )

  if (error) {
    return <div>{t("error-title")}.</div>
  }

  if (isLoading || !data) {
    return <div>{t("loading-text")}</div>
  }

  if (data.length === 0) {
    return <div>{t("no-data")}</div>
  }

  const eChartsData = groupBy(data, (o) => {
    // @ts-expect-error: todo
    const dateString = o.date
    const year = dateString.substring(0, dateString.indexOf("-"))
    return year
  })

  const maxValue = max(data.map((o) => o.count)) || 10000

  return (
    <div
      className={css`
        margin-bottom: 1rem;
      `}
    >
      <Echarts
        height={200 * Object.keys(eChartsData).length}
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
              // eslint-disable-next-line i18next/no-literal-string
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
      <DebugModal data={data} />
    </div>
  )
}

export default dontRenderUntilQueryParametersReady(CourseSubmissionsByDay)
