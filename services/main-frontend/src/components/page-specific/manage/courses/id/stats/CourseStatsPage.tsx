import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import { baseTheme, headingFont } from "../../../../../../shared-module/styles"

import CourseSubmissionsByDay from "./CourseSubmissionsByDay"
import CourseSubmissionsByWeekdayAndHour from "./CourseSubmissionsByWeekdayAndHour"
import CourseUsersCountsByExercise from "./CourseUsersCountsByExercise"

const CourseStatsPage: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  return (
    <>
      <h1
        className={css`
          font-size: clamp(2rem, 3.6vh, 36px);
          color: ${baseTheme.colors.grey[700]};
          font-family: ${headingFont};
          font-weight: bold;
        `}
      >
        {t("title-statistics")}
      </h1>
      <h2
        className={css`
          font-size: 1.8rem;
          color: ${baseTheme.colors.grey[600]};
          font-family: ${headingFont};
          margin-bottom: 1rem;
        `}
      >
        {t("title-course-users-counts-by-exercise")}
      </h2>
      <CourseUsersCountsByExercise courseId={courseId} />
      <h2
        className={css`
          font-size: 1.8rem;
          color: ${baseTheme.colors.grey[600]};
          font-family: ${headingFont};
          margin-bottom: 1rem;
        `}
      >
        {t("title-number-of-submissions-per-day")}
      </h2>
      <CourseSubmissionsByDay courseId={courseId} />
      <h2
        className={css`
          font-size: 1.8rem;
          color: ${baseTheme.colors.grey[600]};
          font-family: ${headingFont};
          margin-bottom: 1rem;
        `}
      >
        {t("title-number-of-submissions-per-weekday-and-hour")}
      </h2>
      <CourseSubmissionsByWeekdayAndHour courseId={courseId} />
    </>
  )
}

export default CourseStatsPage
