import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"

import ExerciseList from "./ExerciseList"
import ExerciseRepositories from "./ExerciseRepositories"

import { baseTheme, headingFont } from "@/shared-module/common/styles"

const CourseExercises: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  return (
    <>
      <h2
        className={css`
          font-size: clamp(2rem, 3.6vh, 36px);
          color: ${baseTheme.colors.gray[700]};
          font-family: ${headingFont};
          font-weight: bold;
        `}
      >
        {t("title-all-exercises")}
      </h2>
      <ExerciseList courseId={courseId} />
      <h2
        className={css`
          font-size: clamp(2rem, 3.6vh, 36px);
          color: ${baseTheme.colors.gray[700]};
          font-family: ${headingFont};
          font-weight: bold;
          padding-top: 1rem;
          margin-bottom: 1rem;
        `}
      >
        {t("manage-exercise-repositories")}
      </h2>
      <ExerciseRepositories courseId={courseId} examId={null} />
    </>
  )
}

export default CourseExercises
