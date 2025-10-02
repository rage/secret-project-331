import { useQuery } from "@tanstack/react-query"
import React from "react"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import { fetchCourseStructure } from "../../../../../../services/backend/courses"

import ManageCourseStructure from "./ManageCourseStructure"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

const CoursePages: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const getCourseStructure = useQuery({
    queryKey: [`course-structure-${courseId}`],
    queryFn: () => fetchCourseStructure(courseId),
  })

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
