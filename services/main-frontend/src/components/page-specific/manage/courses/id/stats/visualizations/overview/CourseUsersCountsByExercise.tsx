import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { reverse, sortBy } from "lodash"
import React from "react"
import { useTranslation } from "react-i18next"

import { InstructionBox } from "../../CourseStatsPage"
import Echarts from "../../Echarts"
import StatsHeader from "../../StatsHeader"

import { fetchCourseUsersCountByExercise } from "@/services/backend/courses"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export interface CourseUsersCountsByExerciseProps {
  courseId: string
}

const CourseUsersCountsByExercise: React.FC<
  React.PropsWithChildren<CourseUsersCountsByExerciseProps>
> = ({ courseId }) => {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: [`course-users-counts-by-exercise-${courseId}`],
    queryFn: () => fetchCourseUsersCountByExercise(courseId),
  })

  if (query.isError) {
    return <ErrorBanner variant="readOnly" error={query.error} />
  }

  if (query.isLoading || !query.data) {
    return <Spinner variant="medium" />
  }

  const queryData = sortBy(query.data, [
    "chapter_number",
    "page_order_number",
    "exercise_order_number",
  ])

  const chapters = Array.from(new Set(queryData.map((obj) => obj.chapter_number)))

  const result = chapters.map((chapter) =>
    // echarts takes the data in reverse order
    reverse(queryData.filter((item) => item.chapter_number === chapter)),
  )

  return (
    <>
      <StatsHeader
        heading={t("stats-heading-exercise-participation", "Exercise Attempts and Points")}
        debugData={query.data}
      />
      <InstructionBox>
        {t(
          "stats-instruction-exercise-participation",
          "Breakdown of student participation and performance for each exercise, showing attempts, partial completions, and full completions",
        )}
      </InstructionBox>
      <div
        className={css`
          margin-bottom: 2rem;
        `}
      >
        {result.map((data) => (
          <div
            className={css`
              margin-bottom: 1.5rem;
              border: 3px solid ${baseTheme.colors.clear[200]};
              border-radius: 6px;
              padding: 1rem;
            `}
            key={JSON.stringify(data[0])}
          >
            <div>
              <h3
                className={css`
                  color: ${baseTheme.colors.gray[400]};
                  font-size: 1.3rem;
                `}
              >{`${t("chapter")} ${data[0].chapter_number}`}</h3>
            </div>
            <Echarts
              height={Math.max(data.length > 2 ? data.length * 100 : (data.length + 1) * 100, 230)}
              options={{
                tooltip: {
                  // eslint-disable-next-line i18next/no-literal-string
                  trigger: "axis",
                  axisPointer: {
                    type: "shadow",
                  },
                },
                grid: {
                  containLabel: true,
                },
                legend: {},
                xAxis: {
                  type: "value",
                  boundaryGap: [0, 0.01],
                },
                yAxis: {
                  type: "category",
                  data: data.map((o) => o.exercise_name || o.exercise_id || ""),
                },
                series: [
                  {
                    name: t("number-of-users-attempted-the-exercise"),
                    type: "bar",
                    data: data.map((o) => o.n_users_attempted),
                  },
                  {
                    name: t("number-of-users-with-some-points"),
                    type: "bar",
                    data: data.map((o) => o.n_users_with_some_points),
                  },
                  {
                    name: t("number-of-users-with-max-points"),
                    type: "bar",
                    data: data.map((o) => o.n_users_with_max_points),
                  },
                ],
              }}
            />
          </div>
        ))}
      </div>
    </>
  )
}

export default withErrorBoundary(CourseUsersCountsByExercise)
