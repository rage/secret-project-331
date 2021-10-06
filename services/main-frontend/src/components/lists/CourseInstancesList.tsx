import Link from "next/link"
import React from "react"
import { useQuery } from "react-query"

import { fetchCourseInstances } from "../../services/backend/courses"
import Button from "../../shared-module/components/Button"

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
    <>
      <ul>
        {data.map((instance) => {
          return (
            <li key={instance.id}>
              {instance.name ?? "Default"}{" "}
              <Link
                href={{
                  pathname: "/manage/course-instances/[id]",
                  query: { id: instance.id },
                }}
              >
                Manage
              </Link>{" "}
              <Link
                href={{
                  pathname: "/manage/course-instances/[id]/emails",
                  query: { id: instance.id },
                }}
              >
                Manage emails
              </Link>{" "}
              <a
                href={`/api/v0/main-frontend/course-instances/${instance.id}/point_export`}
                download
              >
                Export points
              </a>
            </li>
          )
        })}
      </ul>
      <Button variant="primary" size="medium">
        New course instance
      </Button>
    </>
  )
}

export default CourseInstancesList
