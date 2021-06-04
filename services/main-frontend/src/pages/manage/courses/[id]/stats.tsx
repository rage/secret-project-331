import React from "react"

import Layout from "../../../../components/Layout"
import useQueryParameter from "../../../../hooks/useQueryParameter"
import { dontRenderUntilQueryParametersReady } from "../../../../utils/dontRenderUntilQueryParametersReady"
import { normalWidthCenteredComponentStyles } from "../../../../styles/componentStyles"
import { css } from "@emotion/css"
import CourseSubmissionsByDay from "../../../../components/stats/CourseSubmissionsByDay"
import CourseSubmissionsByWeekdayAndHour from "../../../../components/stats/CourseSubmissionsByWeekdayAndHour"

const StatsPage: React.FC<unknown> = () => {
  const id = useQueryParameter("id")

  return (
    <Layout>
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

export default dontRenderUntilQueryParametersReady(StatsPage)
