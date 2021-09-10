import { css } from "@emotion/css"
import React from "react"

import Layout from "../../../../components/Layout"
import CourseSubmissionsByDay from "../../../../components/stats/CourseSubmissionsByDay"
import CourseSubmissionsByWeekdayAndHour from "../../../../components/stats/CourseSubmissionsByWeekdayAndHour"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import basePath from "../../../../shared-module/utils/base-path"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

interface StatsPageProps {
  query: SimplifiedUrlQuery<"id">
}

const StatsPage: React.FC<StatsPageProps> = ({ query }) => {
  const id = query.id
  return (
    <Layout frontPageUrl={basePath()} navVariant="complex">
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
