import { useQuery } from "@tanstack/react-query"
import React from "react"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import { getCourse } from "../../../../../../services/backend/courses"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"
import ManageCourse from "../index/ManageCourse"

const CourseOverview: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const getCourseQuery = useQuery([`course-${courseId}`], () => getCourse(courseId))

  return (
    <>
      {getCourseQuery.isError && <ErrorBanner error={getCourseQuery.error} variant={"readOnly"} />}
      {getCourseQuery.isLoading && <Spinner variant={"medium"} />}
      {getCourseQuery.isSuccess && (
        <ManageCourse course={getCourseQuery.data} refetch={getCourseQuery.refetch} />
      )}
    </>
  )
}

export default CourseOverview
