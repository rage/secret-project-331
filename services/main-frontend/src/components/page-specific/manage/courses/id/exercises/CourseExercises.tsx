import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"

import ExerciseList from "./ExerciseList"

const CourseExercises: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  return (
    <>
      <h2>{t("title-all-exercises")}</h2>
      <ExerciseList courseId={courseId} />
    </>
  )
}

export default CourseExercises
