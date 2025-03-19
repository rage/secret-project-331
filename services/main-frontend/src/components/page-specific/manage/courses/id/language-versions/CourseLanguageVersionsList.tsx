import Link from "next/link"
import React from "react"

import useCourseLanguageVersionsQuery from "@/hooks/useCourseLanguageVersions"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

export interface CourseTranslationsListProps {
  courseId: string
}

const CourseLanguageVersionsList: React.FC<
  React.PropsWithChildren<CourseTranslationsListProps>
> = ({ courseId }) => {
  const getCourseLanguageVersions = useCourseLanguageVersionsQuery(courseId)
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
