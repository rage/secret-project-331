import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../../../components/Layout"
import CourseSubmissionsByDay from "../../../../components/stats/CourseSubmissionsByDay"
import CourseSubmissionsByWeekdayAndHour from "../../../../components/stats/CourseSubmissionsByWeekdayAndHour"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

interface StatsPageProps {
  query: SimplifiedUrlQuery<"id">
}

const StatsPage: React.FC<StatsPageProps> = ({ query }) => {
  const { t } = useTranslation()
  const id = query.id
  return (
    <Layout navVariant="complex">
      <div
        className={css`
          ${normalWidthCenteredComponentStyles}
          margin-bottom: 1rem;
        `}
      >
        <h1>{t("title-statistics")}</h1>
        <h2>{t("title-number-of-submissions-per-day")}</h2>
        <CourseSubmissionsByDay courseId={id} />
        <h2>{t("title-number-of-submissions-per-weekday-and-hour")}</h2>
        <CourseSubmissionsByWeekdayAndHour courseId={id} />
      </div>
    </Layout>
  )
}

export default withErrorBoundary(dontRenderUntilQueryParametersReady(StatsPage))
