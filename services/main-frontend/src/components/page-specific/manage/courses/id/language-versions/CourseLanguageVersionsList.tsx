import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import React from "react"

import { fetchCourseLanguageVersions } from "../../../../../../services/backend/courses"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

export const formatLanguageVersionsQueryKey = (courseId: string): string => {
  // eslint-disable-next-line i18next/no-literal-string
  return `course-${courseId}-language-versions`
}

export interface CourseTranslationsListProps {
  courseId: string
}

const CourseLanguageVersionsList: React.FC<
  React.PropsWithChildren<CourseTranslationsListProps>
> = ({ courseId }) => {
  const getCourseLanguageVersions = useQuery({
    queryKey: [formatLanguageVersionsQueryKey(courseId)],
    queryFn: () => fetchCourseLanguageVersions(courseId),
  })
  return (
    <>
      {getCourseLanguageVersions.isError && (
        <ErrorBanner variant={"readOnly"} error={getCourseLanguageVersions.error} />
      )}
      {getCourseLanguageVersions.isPending && <Spinner variant={"medium"} />}
      {getCourseLanguageVersions.isSuccess && (
        <ul>
          {getCourseLanguageVersions.data.map((course) => (
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
      )}
    </>
  )
}

export default CourseLanguageVersionsList
