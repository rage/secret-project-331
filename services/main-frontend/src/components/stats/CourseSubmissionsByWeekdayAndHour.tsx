import { css } from "@emotion/css"
import { groupBy, max } from "lodash"
import React from "react"
import { useQuery } from "react-query"

import { fetchCourseWeekdayHourSubmissionCounts } from "../../services/backend/courses"
import DebugModal from "../../shared-module/components/DebugModal"
import { dontRenderUntilQueryParametersReady } from "../../shared-module/utils/dontRenderUntilQueryParametersReady"
import Echarts from "../Echarts"

export interface CourseSubmissionsByWeekdayAndHourProps {
  courseId: string
}

const isodowToWeekdayName = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
}

const hours = [
  "00",
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
]

const maxCircleSize = 100

const CourseSubmissionsByWeekdayAndHour: React.FC<CourseSubmissionsByWeekdayAndHourProps> = ({
  courseId,
}) => {
  const { isLoading, error, data } = useQuery(
    `course-submissions-by-weekday-and-hour-${courseId}`,
    () => fetchCourseWeekdayHourSubmissionCounts(courseId),
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

  const dataByWeekDay = groupBy(data, (o) => o.isodow)

  const maxValue = max(data.map((o) => o.count)) || 10000

  return (
    <div
      className={css`
        margin-bottom: 1rem;
      `}
    >
      <Echarts
        height={1000}
        options={{
          title: Object.entries(dataByWeekDay).map(([weekdayNumber, _entries], i) => {
            return {
              textBaseline: "middle",
              top: ((i + 0.5) * 100) / 7 + "%",
              text: isodowToWeekdayName[weekdayNumber],
            }
          }),
          tooltip: {
            position: "top",
            formatter: (a) => {
              return `Hour: ${a.data[0]}<br />Submissions: ${a.data[1]}`
            },
          },
          singleAxis: Object.entries(dataByWeekDay).map(([_weekdayNumber, _entries], i) => {
            return {
              left: 150,
              type: "category",
              boundaryGap: false,
              data: hours,
              top: (i * 100) / 7 + 5 + "%",
              height: 100 / 7 - 10 + "%",
              axisLabel: {
                interval: 2,
              },
            }
          }),
          series: Object.entries(dataByWeekDay).map(([_weekdayNumber, entries], i) => {
            return {
              singleAxisIndex: i,
              coordinateSystem: "singleAxis",
              type: "scatter",
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              data: (entries as any[]).map((o) => [o.hour, o.count]),
              symbolSize: function (dataItem) {
                // scaling the size so that the largest value has size maxCircleSize
                return (dataItem[1] / maxValue) * maxCircleSize
              },
            }
          }),
        }}
      />
      <DebugModal data={data} />
    </div>
  )
}

export default dontRenderUntilQueryParametersReady(CourseSubmissionsByWeekdayAndHour)
