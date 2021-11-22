import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchCourseInstances } from "../../services/backend/courses"
import Button from "../../shared-module/components/Button"

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

  console.log(data)

  return (
    <>
      <ul>
        {data.map((instance) => {
          const name = instance.name ?? t("default-course-instance-name")
          return (
            <li key={instance.id}>
              {name}{" "}
              <Link
                href={{
                  pathname: "/manage/course-instances/[id]",
                  query: { id: instance.id },
                }}
                passHref
              >
                <a href="replace" aria-label={`${t("link-manage")} (${name})`}>
                  {t("link-manage")}
                </a>
              </Link>{" "}
              <Link
                href={{
                  pathname: "/manage/course-instances/[id]/emails",
                  query: { id: instance.id },
                }}
                passHref
              >
                <a href="replace" aria-label={`${t("link-manage-emails")} (${name})`}>
                  {t("link-manage-emails")}
                </a>
              </Link>{" "}
              <a
                href={`/manage/course-instances/${instance.id}/point-list`}
                aria-label={`${t("link-view-points")} (${name})`}
              >
                {t("link-view-points")}
              </a>{" "}
              <a
                href={`/api/v0/main-frontend/course-instances/${instance.id}/point_export`}
                download
                aria-label={`${t("link-export-points")} (${name})`}
              >
                {t("link-export-points")}
              </a>
            </li>
          )
        })}
      </ul>
      <Link
        href={{ pathname: "/manage/courses/[id]/new-course-instance", query: { id: courseId } }}
        passHref
      >
        <a href="replace">
          <Button variant="primary" size="medium">
            {t("button-text-new")}
          </Button>
        </a>
      </Link>
    </>
  )
}

export default CourseInstancesList
