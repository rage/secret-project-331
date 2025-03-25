import { css } from "@emotion/css"
import { parseISO } from "date-fns"
import Link from "next/link"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import useCourseInstancesQuery from "../../../../../../hooks/useCourseInstancesQuery"
import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import {
  manageCourseInstanceEmailsPageRoute,
  manageCourseInstancePageRoute,
  manageCourseInstancePermissionsPageRoute,
  viewCourseInstanceCertificatesPageRoute,
  viewCourseInstanceCompletionsPageRoute,
  viewCourseInstancePointsPageRoute,
} from "../../../../../../utils/routing"

import ModuleCompletionReprocessButton from "./ModuleCompletionReprocessButton"
import NewCourseInstanceDialog from "./NewCourseInstanceDialog"
import PointExportButton from "./PointExportButton"

import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { queryClient } from "@/shared-module/common/services/appQueryClient"
import { baseTheme, headingFont } from "@/shared-module/common/styles"

const CourseCourseInstances: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const [showDialog, setShowDialog] = useState(false)
  const getCourseInstances = useCourseInstancesQuery(courseId)

  const handleCreateNewCourseInstance = async () => {
    setShowDialog(false)
    // eslint-disable-next-line i18next/no-literal-string
    queryClient.invalidateQueries({ queryKey: [`course-${courseId}-course-instances`] })
  }

  return (
    <>
      {getCourseInstances.isError && (
        <ErrorBanner variant={"readOnly"} error={getCourseInstances.error} />
      )}
      {getCourseInstances.isPending && <Spinner variant={"medium"} />}
      {getCourseInstances.isSuccess && (
        <div>
          <h2
            className={css`
              font-size: clamp(2rem, 3.6vh, 36px);
              color: ${baseTheme.colors.gray[700]};
              font-family: ${headingFont};
              font-weight: bold;
            `}
          >
            {t("title-all-course-instances")}
          </h2>
          <ul>
            {getCourseInstances.data
              .sort((a, b) => parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime())
              .map((instance) => {
                const name = instance.name ?? t("default-course-instance-name")
                return (
                  <li key={instance.id}>
                    {name}{" "}
                    <Link
                      href={manageCourseInstancePageRoute(instance.id)}
                      aria-label={`${t("link-manage")} (${name})`}
                    >
                      {t("link-manage")}
                    </Link>{" "}
                    <Link
                      href={manageCourseInstanceEmailsPageRoute(instance.id)}
                      aria-label={`${t("link-manage-emails")} (${name})`}
                    >
                      {t("link-manage-emails")}
                    </Link>{" "}
                    <Link
                      href={manageCourseInstancePermissionsPageRoute(instance.id)}
                      aria-label={`${t("link-manage-permissions")} (${name})`}
                    >
                      {t("link-manage-permissions")}
                    </Link>{" "}
                    <Link
                      href={viewCourseInstanceCertificatesPageRoute(instance.id)}
                      aria-label={`${t("link-manage-certificates")} (${name})`}
                    >
                      {t("link-manage-certificates")}
                    </Link>{" "}
                    <Link
                      href={viewCourseInstanceCompletionsPageRoute(instance.id)}
                      aria-label={`${t("link-view-completions")}`}
                    >
                      {t("link-view-completions")}
                    </Link>{" "}
                    <Link
                      href={viewCourseInstancePointsPageRoute(instance.id)}
                      aria-label={`${t("link-view-points")}`}
                    >
                      {t("link-view-points")}
                    </Link>{" "}
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
