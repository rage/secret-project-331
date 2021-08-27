import Link from "next/link"
import React from "react"
import { useQuery } from "react-query"

import { fetchCourseTranslations } from "../../services/backend/courses"

export interface CourseTranslationsListProps {
  courseId: string
}

const CourseTranslationsList: React.FC<CourseTranslationsListProps> = ({ courseId }) => {
  const { isLoading, error, data } = useQuery(`course-${courseId}-translations`, () =>
    fetchCourseTranslations(courseId),
  )

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <>Loading...</>
  }

  return (
    <ul>
      {data.map((course) => (
        <li key={course.id}>
          <Link
            href={{
              pathname: "/manage/courses/[id]",
              query: { id: course.id },
            }}
          >
            {course.name ?? "Default"}
          </Link>{" "}
          <span>({course.language_code})</span>
        </li>
      ))}
    </ul>
  )
}

export default CourseTranslationsList
