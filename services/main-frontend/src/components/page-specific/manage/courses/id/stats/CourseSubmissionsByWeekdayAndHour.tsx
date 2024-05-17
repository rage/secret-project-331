import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { Dictionary, groupBy, max } from "lodash"
import React from "react"
import { useTranslation } from "react-i18next"

import { fetchCourseWeekdayHourSubmissionCounts } from "../../../../../../services/backend/courses"
import { ExerciseSlideSubmissionCountByWeekAndHour } from "../../../../../../shared-module/bindings"
import DebugModal from "../../../../../../shared-module/components/DebugModal"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"
import { baseTheme } from "../../../../../../shared-module/styles"
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

const CourseSubmissionsByWeekdayAndHour: React.FC<
  React.PropsWithChildren<CourseSubmissionsByWeekdayAndHourProps>
> = ({ courseId }) => {
  const { t } = useTranslation()
  const getCourseWeekdayHourSubmissionCount = useQuery({
    queryKey: [`course-submissions-by-weekday-and-hour-${courseId}`],
    queryFn: () => fetchCourseWeekdayHourSubmissionCounts(courseId),
    select: (data) => {
      const dataByWeekDay = makeSureAllDaysHaveEntries(groupBy(data, (o) => o.isodow))
      const maxValue = max(data.map((o) => o.count)) || 10000
      return { apiData: data, dataByWeekDay, maxValue }
    },
  })

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

  if (getCourseWeekdayHourSubmissionCount.isPending) {
    return <Spinner variant={"medium"} />
  }

  if (getCourseWeekdayHourSubmissionCount.data.apiData.length === 0) {
    return <div>{t("no-data")}</div>
  }

  const dataByWeekDayOrdered = Object.entries(
    getCourseWeekdayHourSubmissionCount.data.dataByWeekDay,
  ).sort(([num, _a], [num2, _a2]) => Number(num) - Number(num2))

  dataByWeekDayOrdered.push(["2", []])

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
          singleAxis: dataByWeekDayOrdered.map(([_weekdayNumber, _entries], i) => {
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
          }),
          series: dataByWeekDayOrdered.map(([_weekdayNumber, entries], i) => {
            return {
              singleAxisIndex: i,
              // eslint-disable-next-line i18next/no-literal-string
              coordinateSystem: "singleAxis",
              // eslint-disable-next-line i18next/no-literal-string
              type: "scatter",
              // eslint-disable-next-line
                data: entries.map((o) => [o.hour ?? -1, o.count ?? -1]),
              symbolSize: function (dataItem) {
                // scaling the size so that the largest value has size maxCircleSize
                return (
                  (dataItem[1] / getCourseWeekdayHourSubmissionCount.data.maxValue) * maxCircleSize
                )
              },
            }
          }),
        }}
      />
      <DebugModal data={getCourseWeekdayHourSubmissionCount.data.apiData} />
    </div>
  )
}

export default withErrorBoundary(
  dontRenderUntilQueryParametersReady(CourseSubmissionsByWeekdayAndHour),
)

function makeSureAllDaysHaveEntries(
  dict: Dictionary<ExerciseSlideSubmissionCountByWeekAndHour[]>,
): Dictionary<ExerciseSlideSubmissionCountByWeekAndHour[]> {
  if (dict["1"] === null || dict["1"] === undefined) {
    dict["1"] = []
  }
  if (dict["2"] === null || dict["2"] === undefined) {
    dict["2"] = []
  }
  if (dict["3"] === null || dict["3"] === undefined) {
    dict["3"] = []
  }
  if (dict["4"] === null || dict["4"] === undefined) {
    dict["4"] = []
  }
  if (dict["5"] === null || dict["5"] === undefined) {
    dict["5"] = []
  }
  if (dict["6"] === null || dict["6"] === undefined) {
    dict["6"] = []
  }
  if (dict["7"] === null || dict["7"] === undefined) {
    dict["7"] = []
  }
  return dict
}
