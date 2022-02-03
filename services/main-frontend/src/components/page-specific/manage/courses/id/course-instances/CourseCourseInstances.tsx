import Link from "next/link"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchCourseInstances } from "../../../../../../services/backend/courses"
import Button from "../../../../../../shared-module/components/Button"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"
import { queryClient } from "../../../../../../shared-module/services/appQueryClient"
import {
  manageCourseInstanceEmailsPageRoute,
  manageCourseInstancePageRoute,
} from "../../../../../../utils/routing"
import { CourseOverviewTabsProps } from "../index/CourseOverviewTabNavigator"

import NewCourseInstanceDialog from "./NewCourseInstanceDialog"
import PointExportButton from "./PointExportButton"

const CourseCourseInstances: React.FC<CourseOverviewTabsProps> = ({ courseId }) => {
  const { t } = useTranslation()
  const [showDialog, setShowDialog] = useState(false)
  const getCourseInstances = useQuery(`course-${courseId}-course-instances`, () =>
    fetchCourseInstances(courseId),
  )

  const handleCreateNewCourseInstance = async () => {
    setShowDialog(false)
    // eslint-disable-next-line i18next/no-literal-string
    queryClient.invalidateQueries(`course-${courseId}-course-instances`)
  }

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

      {showDialog && (
        <NewCourseInstanceDialog
          onClose={() => setShowDialog(false)}
          showDialog={showDialog}
          courseId={courseId}
          onSubmit={handleCreateNewCourseInstance}
        />
      )}
      <Button variant="primary" size="medium" onClick={() => setShowDialog(true)}>
        {t("button-text-new")}
      </Button>
    </>
  )
}

export default CourseCourseInstances
