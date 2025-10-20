"use client"
import Link from "next/link"
import React from "react"

import useCourseLanguageVersions from "@/hooks/useCourseLanguageVersions"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

export interface CourseTranslationsListProps {
  courseId: string
}

const CourseLanguageVersionsList: React.FC<
  React.PropsWithChildren<CourseTranslationsListProps>
> = ({ courseId }) => {
  const getCourseLanguageVersions = useCourseLanguageVersions(courseId)
  return (
    <>
      {getCourseLanguageVersions.isError && (
        <ErrorBanner variant={"readOnly"} error={getCourseLanguageVersions.error} />
      )}
      {getCourseLanguageVersions.isLoading && <Spinner variant={"medium"} />}
      {getCourseLanguageVersions.isSuccess && (
        <ul>
          {getCourseLanguageVersions.data.map((course) => (
            <li key={course.id}>
              <Link href={`/manage/courses/${course.id}`}>{course.name}</Link>{" "}
              <span>({course.language_code})</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export default CourseLanguageVersionsList
