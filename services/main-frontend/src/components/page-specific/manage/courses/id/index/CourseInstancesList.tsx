import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchCourseInstances } from "../../../../../../services/backend/courses"
import Button from "../../../../../../shared-module/components/Button"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"
import {
  manageCourseInstanceEmailsPageRoute,
  manageCourseInstancePageRoute,
} from "../../../../../../utils/routing"

import PointExportButton from "./PointExportButton"

export interface CourseInstancesListProps {
  courseId: string
}

const CourseInstancesList: React.FC<CourseInstancesListProps> = ({ courseId }) => {
  const { t } = useTranslation()
  const getCourseInstances = useQuery(`course-${courseId}-course-instances`, () =>
    fetchCourseInstances(courseId),
  )

  return (
    <>
      {getCourseInstances.isError && (
        <ErrorBanner variant={"readOnly"} error={getCourseInstances.error} />
      )}
      {(getCourseInstances.isLoading || getCourseInstances.isIdle) && (
        <Spinner variant={"medium"} />
      )}
      {getCourseInstances.isSuccess && (
        <ul>
          {getCourseInstances.data.map((instance) => {
            const name = instance.name ?? t("default-course-instance-name")
            return (
              <li key={instance.id}>
                {name}{" "}
                <Link href={manageCourseInstancePageRoute(instance.id)} passHref>
                  <a href="replace" aria-label={`${t("link-manage")} (${name})`}>
                    {t("link-manage")}
                  </a>
                </Link>{" "}
                <Link href={manageCourseInstanceEmailsPageRoute(instance.id)} passHref>
                  <a href="replace" aria-label={`${t("link-manage-emails")} (${name})`}>
                    {t("link-manage-emails")}
                  </a>
                </Link>{" "}
                <a
                  href={`/manage/course-instances/${instance.id}/points`}
                  aria-label={`${t("link-view-points")} (${name})`}
                >
                  {t("link-view-points")}
                </a>{" "}
                <PointExportButton courseInstanceId={instance.id} courseInstanceName={name} />
              </li>
            )
          })}
        </ul>
      )}
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
