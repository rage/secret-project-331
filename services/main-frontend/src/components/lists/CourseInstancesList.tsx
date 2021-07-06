import React from "react"
import { useQuery } from "react-query"

import { fetchCourseInstances } from "../../services/backend/courses"

export interface CourseInstancesListProps {
  courseId: string
}

const CourseInstancesList: React.FC<CourseInstancesListProps> = ({ courseId }) => {
  const { isLoading, error, data } = useQuery(`course-${courseId}-course-instances`, () =>
    fetchCourseInstances(courseId),
  )

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <>Loading...</>
  }

  return (
    <ul>
      {data.map((instance) => {
        return (
          <li key={instance.id}>
            {instance.name ?? "Default"}{" "}
            <a href={`/cms/course-instances/${instance.id}/manage-emails`}>Manage e-mails</a>
          </li>
        )
      })}
    </ul>
  )
}

export default CourseInstancesList
