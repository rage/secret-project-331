import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchCourseExercises } from "../../services/backend/courses"

export interface ExerciseListProps {
  courseId: string
}

const ExerciseList: React.FC<ExerciseListProps> = ({ courseId }) => {
  const { t } = useTranslation()
  const { data, error, isLoading } = useQuery(`course-${courseId}-exercises`, () =>
    fetchCourseExercises(courseId),
  )

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <>{t("loading-text")}</>
  }

  return (
    <ul>
      {data.map((x) => (
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
  )
}

export default ExerciseList
