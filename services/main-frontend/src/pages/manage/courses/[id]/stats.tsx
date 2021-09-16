import { css } from "@emotion/css"
import React from "react"

import Layout from "../../../../components/Layout"
import CourseSubmissionsByDay from "../../../../components/stats/CourseSubmissionsByDay"
import CourseSubmissionsByWeekdayAndHour from "../../../../components/stats/CourseSubmissionsByWeekdayAndHour"
import useQueryParameter from "../../../../shared-module/hooks/useQueryParameter"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import basePath from "../../../../shared-module/utils/base-path"
import { dontRenderUntilQueryParametersReady } from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

const StatsPage: React.FC<unknown> = () => {
  const id = useQueryParameter("id")

  return (
    <Layout navVariant="complex">
      <div
        className={css`
          ${normalWidthCenteredComponentStyles}
          margin-bottom: 1rem;
        `}
      >
        <h1>Statistics</h1>
        <h2>Number of submissions per day</h2>
        <CourseSubmissionsByDay courseId={id} />
        <h2>Number of submissions hourly per weekday</h2>
        <CourseSubmissionsByWeekdayAndHour courseId={id} />
      </div>
    </Layout>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(StatsPage))
