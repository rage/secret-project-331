"use client"

import React from "react"

import ManageCourseStructure from "./ManageCourseStructure"

import { CourseManagementPagesProps } from "@/app/manage/courses/[id]/types"
import { useCourseStructure } from "@/hooks/useCourseStructure"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

const CoursePages: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const getCourseStructure = useCourseStructure(courseId)

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
