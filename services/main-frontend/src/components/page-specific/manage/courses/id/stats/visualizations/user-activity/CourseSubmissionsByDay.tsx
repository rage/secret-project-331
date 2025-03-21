import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { groupBy, max } from "lodash"
import React from "react"
import { useTranslation } from "react-i18next"

import { InstructionBox } from "../../CourseStatsPage"
import Echarts from "../../Echarts"
import StatsHeader from "../../StatsHeader"

import { fetchCourseDailySubmissionCounts } from "@/services/backend/courses"
import DebugModal from "@/shared-module/common/components/DebugModal"
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
  const getCourseDailySubmissionCounts = useQuery({
    queryKey: [`course-daily-submission-counts-${courseId}`],
    queryFn: () => fetchCourseDailySubmissionCounts(courseId),
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
      <StatsHeader
        heading={t("stats-heading-daily-submissions")}
        debugData={getCourseDailySubmissionCounts.data.apiData}
      />
      <InstructionBox>{t("stats-instruction-daily-submissions")}</InstructionBox>
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

export default withErrorBoundary(dontRenderUntilQueryParametersReady(CourseSubmissionsByDay))
