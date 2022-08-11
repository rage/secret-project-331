import { useTranslation } from "react-i18next"
import { css } from "@emotion/css"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import { baseTheme, headingFont } from "../../../../../../shared-module/styles"

import ExerciseList from "./ExerciseList"

const CourseExercises: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  return (
    <>
      <h2
        className={
          css`
            font-size: clamp(2rem, 3.6vh, 36px);
            color: ${baseTheme.colors.grey[700]};
            font-family: ${headingFont};
            font-weight: bold;
  
          `
        }
      >{t("title-all-exercises")}</h2>
      <ExerciseList courseId={courseId} />
    </>
  )
}

export default CourseExercises
