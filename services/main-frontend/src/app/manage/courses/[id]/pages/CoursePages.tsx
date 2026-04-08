"use client"

import { useQuery } from "@tanstack/react-query"
import React from "react"

import ManageCourseStructure from "./ManageCourseStructure"

import { CourseManagementPagesProps } from "@/app/manage/courses/[id]/types"
import { getCourseStructureOptions } from "@/services/backend/courses"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

const CoursePages: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const getCourseStructure = useQuery(getCourseStructureOptions(courseId))

  return (
    <>
      {getCourseStructure.isError && (
        <ErrorBanner variant={"link"} error={getCourseStructure.error} />
      )}
      {getCourseStructure.isLoading && <Spinner variant={"medium"} />}
      {getCourseStructure.isSuccess && (
        <ManageCourseStructure
          courseStructure={getCourseStructure.data}
          refetch={getCourseStructure.refetch}
        />
      )}
    </>
  )
}

export default CoursePages
