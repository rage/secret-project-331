import React from "react"

import useCourseQuery from "../../../../../../hooks/useCourseQuery"
import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"
import ManageCourse from "../index/ManageCourse"

const CourseOverview: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const courseQuery = useCourseQuery(courseId)

  return (
    <>
      {courseQuery.isError && <ErrorBanner error={courseQuery.error} variant={"readOnly"} />}
      {courseQuery.isPending && <Spinner variant={"medium"} />}
      {courseQuery.isSuccess && (
        <ManageCourse course={courseQuery.data} refetch={courseQuery.refetch} />
      )}
    </>
  )
}

export default CourseOverview
