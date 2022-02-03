import { useTranslation } from "react-i18next"

import { CourseOverviewTabsProps } from "../index/CourseOverviewTabNavigator"

import ExerciseList from "./ExerciseList"

const CourseExercises: React.FC<CourseOverviewTabsProps> = ({ courseId }) => {
  const { t } = useTranslation()
  return (
    <>
      <h2>{t("title-all-exercises")}</h2>
      <ExerciseList courseId={courseId} />
    </>
  )
}

export default CourseExercises
