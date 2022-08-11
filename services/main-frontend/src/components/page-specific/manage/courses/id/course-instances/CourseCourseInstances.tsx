import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { css } from "@emotion/css"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import { fetchCourseInstances } from "../../../../../../services/backend/courses"
import Button from "../../../../../../shared-module/components/Button"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"
import { baseTheme, headingFont } from "../../../../../../shared-module/styles"
import { queryClient } from "../../../../../../shared-module/services/appQueryClient"
import {
  manageCourseInstanceEmailsPageRoute,
  manageCourseInstancePageRoute,
  manageCourseInstancePermissionsPageRoute,
} from "../../../../../../utils/routing"

import ModuleCompletionReprocessButton from "./ModuleCompletionReprocessButton"
import NewCourseInstanceDialog from "./NewCourseInstanceDialog"
import PointExportButton from "./PointExportButton"

const CourseCourseInstances: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const [showDialog, setShowDialog] = useState(false)
  const getCourseInstances = useQuery([`course-${courseId}-course-instances`], () =>
    fetchCourseInstances(courseId),
  )

  const handleCreateNewCourseInstance = async () => {
    setShowDialog(false)
    // eslint-disable-next-line i18next/no-literal-string
    queryClient.invalidateQueries([`course-${courseId}-course-instances`])
  }

  return (
    <>
      {getCourseInstances.isError && (
        <ErrorBanner variant={"readOnly"} error={getCourseInstances.error} />
      )}
      {getCourseInstances.isLoading && <Spinner variant={"medium"} />}
      {getCourseInstances.isSuccess && (
        <div>
          <h2
            className={
              css`
                font-size: clamp(2rem, 3.6vh, 36px);
                color: ${baseTheme.colors.grey[700]};
                font-family: ${headingFont};
                font-weight: bold;
      
              `
            }
          >{t("title-all-course-instances")}</h2>
          <ul>
            {getCourseInstances.data
              .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
              .map((instance) => {
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
                    <Link href={manageCourseInstancePermissionsPageRoute(instance.id)} passHref>
                      <a href="replace" aria-label={`${t("link-manage-permissions")} (${name})`}>
                        {t("link-manage-permissions")}
                      </a>
                    </Link>{" "}
                    <a
                      href={`/manage/course-instances/${instance.id}/points`}
                      aria-label={`${t("link-view-points")} (${name})`}
                    >
                      {t("link-view-points")}
                    </a>{" "}
                    <PointExportButton courseInstanceId={instance.id} courseInstanceName={name} />
                    <ModuleCompletionReprocessButton courseInstanceId={instance.id} />
                  </li>
                )
              })}
          </ul>
        </div>
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
