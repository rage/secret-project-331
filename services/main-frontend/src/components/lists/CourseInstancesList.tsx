import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchCourseInstances } from "../../services/backend/courses"

export interface CourseInstancesListProps {
  courseId: string
}

const CourseInstancesList: React.FC<CourseInstancesListProps> = ({ courseId }) => {
  const { t } = useTranslation()
  const { isLoading, error, data } = useQuery(`course-${courseId}-course-instances`, () =>
    fetchCourseInstances(courseId),
  )

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <>{t("loading-text")}</>
  }

  return (
    <ul>
      {data.map((instance) => {
        return (
          <li key={instance.id}>
            {instance.name ?? t("default-course-instance-name")}{" "}
            <Link
              href={{
                pathname: "/manage/course-instances/[id]/emails",
                query: { id: instance.id },
              }}
            >
              {t("link-manage-emails")}
            </Link>{" "}
            <a href={`/api/v0/main-frontend/course-instances/${instance.id}/point_export`} download>
              {t("link-export-points")}
            </a>
          </li>
        )
      })}
    </ul>
  )
}

export default CourseInstancesList
