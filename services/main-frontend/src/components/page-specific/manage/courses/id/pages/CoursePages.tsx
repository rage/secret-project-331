import React from "react"
import { useQuery } from "react-query"

import { fetchCourseStructure } from "../../../../../../services/backend/courses"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"
import { CourseOverviewTabsProps } from "../index/CourseOverviewTabNavigator"

import ManageCourseStructure from "./ManageCourseStructure"

const CoursePages: React.FC<CourseOverviewTabsProps> = ({ courseId }) => {
  const getCourseStructure = useQuery(`course-structure-${courseId}`, () =>
    fetchCourseStructure(courseId),
  )

  return (
    <>
      {getCourseStructure.isError && (
        <ErrorBanner variant={"link"} error={getCourseStructure.error} />
      )}
      {(getCourseStructure.isLoading || getCourseStructure.isIdle) && (
        <Spinner variant={"medium"} />
      )}
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
