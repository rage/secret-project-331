import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { sortBy } from "lodash"
import React from "react"
import { useTranslation } from "react-i18next"

import { fetchCourseUsersCountByExercise } from "../../../../../../services/backend/courses"
import DebugModal from "../../../../../../shared-module/components/DebugModal"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"
import { dontRenderUntilQueryParametersReady } from "../../../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../../../shared-module/utils/withErrorBoundary"

import Echarts from "./Echarts"

export interface CourseUsersCountsByExerciseProps {
  courseId: string
}

const CourseUsersCountsByExercise: React.FC<
  React.PropsWithChildren<CourseUsersCountsByExerciseProps>
> = ({ courseId }) => {
  const { t } = useTranslation()
  const query = useQuery([`course-users-counts-by-exercise-${courseId}`], () =>
    fetchCourseUsersCountByExercise(courseId),
  )

  if (query.isError) {
    return <ErrorBanner variant="readOnly" error={query.error} />
  }

  if (query.isLoading || !query.data) {
    return <Spinner variant="medium" />
  }

  // eslint-disable-next-line i18next/no-literal-string
  const data = sortBy(query.data, ["chapter_number", "page_order_number", "exercise_order_number"])

  return (
    <div
      className={css`
        margin-bottom: 1rem;
      `}
    >
      <Echarts
        height={data.length * 100}
        options={{
          tooltip: {
            // eslint-disable-next-line i18next/no-literal-string
            trigger: "axis",
            axisPointer: {
              // eslint-disable-next-line i18next/no-literal-string
              type: "shadow",
            },
          },
          grid: {
            containLabel: true,
          },
          legend: {},
          xAxis: {
            // eslint-disable-next-line i18next/no-literal-string
            type: "value",
            boundaryGap: [0, 0.01],
          },
          yAxis: {
            // eslint-disable-next-line i18next/no-literal-string
            type: "category",
            data: data.map((o) => o.exercise_name || o.exercise_id || ""),
          },
          series: [
            {
              name: t("number-of-users-attempted-the-exercise"),
              // eslint-disable-next-line i18next/no-literal-string
              type: "bar",
              data: data.map((o) => o.n_users_attempted),
            },
            {
              name: t("number-of-users-with-some-points"),
              // eslint-disable-next-line i18next/no-literal-string
              type: "bar",
              data: data.map((o) => o.n_users_with_some_points),
            },
            {
              name: t("number-of-users-with-max-points"),
              // eslint-disable-next-line i18next/no-literal-string
              type: "bar",
              data: data.map((o) => o.n_users_with_max_points),
            },
          ],
        }}
      />
      <DebugModal data={data} />
    </div>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(CourseUsersCountsByExercise))
