import React from "react"
import { useTranslation } from "react-i18next"

import { CourseOverviewTabsProps } from "../index/CourseOverviewTabNavigator"

import CourseSubmissionsByDay from "./CourseSubmissionsByDay"
import CourseSubmissionsByWeekdayAndHour from "./CourseSubmissionsByWeekdayAndHour"

const CourseStatsPage: React.FC<CourseOverviewTabsProps> = ({ courseId }) => {
  const { t } = useTranslation()
  return (
    <>
      <h1>{t("title-statistics")}</h1>
      <h2>{t("title-number-of-submissions-per-day")}</h2>
      <CourseSubmissionsByDay courseId={courseId} />
      <h2>{t("title-number-of-submissions-per-weekday-and-hour")}</h2>
      <CourseSubmissionsByWeekdayAndHour courseId={courseId} />
    </>
  )
}

export default CourseStatsPage
