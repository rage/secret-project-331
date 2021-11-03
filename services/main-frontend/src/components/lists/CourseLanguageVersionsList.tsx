import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchCourseLanguageVersions } from "../../services/backend/courses"

// eslint-disable-next-line i18next/no-literal-string
export const formatQueryKey = (courseId: string): string => `course-${courseId}-language-versions`

export interface CourseTranslationsListProps {
  courseId: string
}

const CourseLanguageVersionsList: React.FC<CourseTranslationsListProps> = ({ courseId }) => {
  const { t } = useTranslation()
  const { isLoading, error, data } = useQuery(formatQueryKey(courseId), () =>
    fetchCourseLanguageVersions(courseId),
  )

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <>{t("loading-text")}</>
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
            {course.name}
          </Link>{" "}
          <span>({course.language_code})</span>
        </li>
      ))}
    </ul>
  )
}

export default CourseLanguageVersionsList
