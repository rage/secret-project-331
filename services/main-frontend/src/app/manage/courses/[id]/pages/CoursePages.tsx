"use client"

import React from "react"

import ManageCourseStructure from "./ManageCourseStructure"

import type { CourseManagementPagesProps } from "@/app/manage/courses/[id]/types"
import { useCourseStructure } from "@/hooks/useCourseStructure"
import { QueryResult } from "@/shared-module/components"

const CoursePages: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const getCourseStructure = useCourseStructure(courseId)

  return (
    <QueryResult query={getCourseStructure}>
      {(data) => (
        <ManageCourseStructure courseStructure={data} refetch={getCourseStructure.refetch} />
      )}
    </QueryResult>
  )
}

export default CoursePages
