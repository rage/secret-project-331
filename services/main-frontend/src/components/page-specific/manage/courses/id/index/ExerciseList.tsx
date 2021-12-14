import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchCourseExercises } from "../../../../../../services/backend/courses"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"

export interface ExerciseListProps {
  courseId: string
}

const ExerciseList: React.FC<ExerciseListProps> = ({ courseId }) => {
  const { t } = useTranslation()
  const getCourseExercises = useQuery(`course-${courseId}-exercises`, () =>
    fetchCourseExercises(courseId),
  )

  return (
    <>
      {getCourseExercises.isError && (
        <ErrorBanner variant={"readOnly"} error={getCourseExercises.error} />
      )}
      {getCourseExercises.isLoading && <Spinner variant={"medium"} />}
      {getCourseExercises.isSuccess && (
        <ul>
          {getCourseExercises.data.map((x) => (
            <li key={x.id}>
              {x.name}{" "}
              <Link
                href={{
                  pathname: "/manage/exercises/[exerciseId]/submissions",
                  query: { exerciseId: x.id },
                }}
              >
                {t("link-view-submissions")}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export default ExerciseList
