import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import { baseTheme, headingFont } from "../../../../../../shared-module/common/styles"

import ExerciseList from "./ExerciseList"
import ExerciseRepositories from "./ExerciseRepositories"

const CourseExercises: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  return (
    <>
      <h2>{t("manage-exercise-repositories")}</h2>
      <ExerciseRepositories courseId={courseId} examId={null} />
      <h2
        className={css`
          font-size: clamp(2rem, 3.6vh, 36px);
          color: ${baseTheme.colors.gray[700]};
          font-family: ${headingFont};
          font-weight: bold;
          text-align: center;
        `}
      >
        {t("title-all-exercises")}
      </h2>
      <ExerciseList courseId={courseId} />
    </>
  )
}

export default CourseExercises
