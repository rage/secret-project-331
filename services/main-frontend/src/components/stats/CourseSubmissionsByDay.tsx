import React from "react"

import { useQuery } from "react-query"
import { dontRenderUntilQueryParametersReady } from "../../utils/dontRenderUntilQueryParametersReady"
import { fetchCourseDailySubmissionCounts } from "../../services/backend/courses"

import DebugModal from "../DebugModal"
import { groupBy, max } from "lodash"
import Echarts from "../Echarts"
import { css } from "@emotion/css"

export interface CourseSubmissionsByDayProps {
  courseId: string
}

const CourseSubmissionsByDay: React.FC<CourseSubmissionsByDayProps> = ({ courseId }) => {
  const { isLoading, error, data } = useQuery(`course-daily-submission-counts-${courseId}`, () =>
    fetchCourseDailySubmissionCounts(courseId),
  )

  if (error) {
    return <div>Error.</div>
  }

  if (isLoading || !data) {
    return <div>Loading...</div>
  }

  if (data.length === 0) {
    return <div>No data</div>
  }

  const eChartsData = groupBy(data, (o) => {
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
            position: "top",
            formatter: (a) => {
              return `Day: ${a.data[0]}<br />Submissions: ${a.data[1]}`
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
