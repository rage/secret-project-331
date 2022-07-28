import React from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"

import CourseSubmissionsByDay from "./CourseSubmissionsByDay"
import CourseSubmissionsByWeekdayAndHour from "./CourseSubmissionsByWeekdayAndHour"
import CourseUsersCountsByExercise from "./CourseUsersCountsByExercise"

const CourseStatsPage: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  return (
    <>
      <h1>{t("title-statistics")}</h1>
      <h2>{t("title-course-users-counts-by-exercise")}</h2>
      <CourseUsersCountsByExercise courseId={courseId} />
      <h2>{t("title-number-of-submissions-per-day")}</h2>
      <CourseSubmissionsByDay courseId={courseId} />
      <h2>{t("title-number-of-submissions-per-weekday-and-hour")}</h2>
      <CourseSubmissionsByWeekdayAndHour courseId={courseId} />
    </>
  )
}

export default CourseStatsPage
