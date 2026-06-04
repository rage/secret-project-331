"use client"

import React from "react"

import ManageCourse from "./ManageCourse"

import { CourseManagementPagesProps } from "@/app/manage/courses/[id]/types"
import { useCourseQuery } from "@/hooks/useCourseQuery"
import { QueryResult } from "@/shared-module/components"

const CourseOverview: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const courseQuery = useCourseQuery(courseId)

  return (
    <QueryResult query={courseQuery}>
      {(course) => <ManageCourse course={course} refetch={courseQuery.refetch} />}
    </QueryResult>
  )
}

export default CourseOverview
