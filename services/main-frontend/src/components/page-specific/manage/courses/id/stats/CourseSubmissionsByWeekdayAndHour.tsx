import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { groupBy, max } from "lodash"
import React from "react"
import { useTranslation } from "react-i18next"

import { fetchCourseWeekdayHourSubmissionCounts } from "../../../../../../services/backend/courses"
import DebugModal from "../../../../../../shared-module/components/DebugModal"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"
import { dontRenderUntilQueryParametersReady } from "../../../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../../../shared-module/utils/withErrorBoundary"

import Echarts from "./Echarts"

export interface CourseSubmissionsByWeekdayAndHourProps {
  courseId: string
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
  const { t } = useTranslation()
  const getCourseWeekdayHourSubmissionCount = useQuery(
    [`course-submissions-by-weekday-and-hour-${courseId}`],
    () => fetchCourseWeekdayHourSubmissionCounts(courseId),
    {
      select: (data) => {
        const dataByWeekDay = groupBy(data, (o) => o.isodow)
        const maxValue = max(data.map((o) => o.count)) || 10000
        return { apiData: data, dataByWeekDay, maxValue }
      },
    }
  )

  const isodowToWeekdayName = {
    1: t("weekday-monday"),
    2: t("weekday-tuesday"),
    3: t("weekday-wednesday"),
    4: t("weekday-thursday"),
    5: t("weekday-friday"),
    6: t("weekday-saturday"),
    7: t("weekday-sunday"),
  }

  if (getCourseWeekdayHourSubmissionCount.isError) {
    return <ErrorBanner variant={"readOnly"} error={getCourseWeekdayHourSubmissionCount.error} />
  }

  if (getCourseWeekdayHourSubmissionCount.isLoading || getCourseWeekdayHourSubmissionCount.isIdle) {
    return <Spinner variant={"medium"} />
  }

  if (getCourseWeekdayHourSubmissionCount.data.apiData.length === 0) {
    return <div>{t("no-data")}</div>
  }

  return (
    <div
      className={css`
        margin-bottom: 1rem;
      `}
    >
      <Echarts
        height={1000}
        options={{
          title: Object.keys(isodowToWeekdayName).map((weekdayNumber, i) => {
            return {
              // eslint-disable-next-line i18next/no-literal-string
              textBaseline: "middle",
              top: ((i + 0.5) * 100) / 7 + "%",
              // @ts-expect-error: todo
              text: isodowToWeekdayName[weekdayNumber],
            }
          }),
          tooltip: {
            // eslint-disable-next-line i18next/no-literal-string
            position: "top",
            formatter: (a) => {
              return t("hourly-submissions-visualization-tooltip", {
                // @ts-expect-error: todo
                day: a.data[0],
                // @ts-expect-error: todo
                submissions: a.data[1],
              })
            },
          },
          singleAxis: Object.entries(getCourseWeekdayHourSubmissionCount.data.dataByWeekDay).map(
            ([_weekdayNumber, _entries], i) => {
              return {
                left: 150,
                // eslint-disable-next-line i18next/no-literal-string
                type: "category",
                boundaryGap: false,
                data: hours,
                top: (i * 100) / 7 + 5 + "%",
                height: 100 / 7 - 10 + "%",
                axisLabel: {
                  interval: 2,
                },
              }
            },
          ),
          series: Object.entries(getCourseWeekdayHourSubmissionCount.data.dataByWeekDay).map(
            ([_weekdayNumber, entries], i) => {
              return {
                singleAxisIndex: i,
                // eslint-disable-next-line i18next/no-literal-string
                coordinateSystem: "singleAxis",
                // eslint-disable-next-line i18next/no-literal-string
                type: "scatter",
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data: (entries as any[]).map((o) => [o.hour, o.count]),
                symbolSize: function (dataItem) {
                  // scaling the size so that the largest value has size maxCircleSize
                  return (
                    (dataItem[1] / getCourseWeekdayHourSubmissionCount.data.maxValue) *
                    maxCircleSize
                  )
                },
              }
            },
          ),
        }}
      />
      <DebugModal data={getCourseWeekdayHourSubmissionCount.data.apiData} />
    </div>
  )
}

export default withErrorBoundary(
  dontRenderUntilQueryParametersReady(CourseSubmissionsByWeekdayAndHour),
)
