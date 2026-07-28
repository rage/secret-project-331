"use client"

import React from "react"

import type { CourseManagementPagesProps } from "@/app/manage/courses/[id]/types"
import { useCourseQuery } from "@/hooks/useCourseQuery"
import { QueryResult } from "@/shared-module/components"

import ManageCourse from "./ManageCourse"
import SuspectedCheatersReviewBanner from "./SuspectedCheatersReviewBanner"

const CourseOverview: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const courseQuery = useCourseQuery(courseId)

  return (
    <>
      <SuspectedCheatersReviewBanner courseId={courseId} />
      <QueryResult query={courseQuery}>
        {(course) => <ManageCourse course={course} refetch={courseQuery.refetch} />}
      </QueryResult>
    </>
  )
}

export default CourseOverview
