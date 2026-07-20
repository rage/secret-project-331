"use client"

import Link from "next/link"
import React from "react"

import useCourseLanguageVersions from "@/hooks/useCourseLanguageVersions"
import { manageCourseByIdRoute } from "@/shared-module/common/utils/routes"
import { QueryResult } from "@/shared-module/components"

export interface CourseTranslationsListProps {
  courseId: string
}

const CourseLanguageVersionsList: React.FC<
  React.PropsWithChildren<CourseTranslationsListProps>
> = ({ courseId }) => {
  const getCourseLanguageVersions = useCourseLanguageVersions(courseId)
  return (
    <QueryResult query={getCourseLanguageVersions} emptyFallback={<ul></ul>}>
      {(data) => (
        <ul>
          {data.map((course) => (
            <li key={course.id}>
              <Link href={manageCourseByIdRoute(course.id)}>{course.name}</Link>{" "}
              <span>({course.language_code})</span>
            </li>
          ))}
        </ul>
      )}
    </QueryResult>
  )
}

export default CourseLanguageVersionsList
