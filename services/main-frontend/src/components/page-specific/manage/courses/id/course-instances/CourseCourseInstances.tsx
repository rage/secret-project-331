import { css } from "@emotion/css"
import { parseISO } from "date-fns"
import Link from "next/link"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import useCourseInstancesQuery, {
  invalidateCourseInstances,
} from "../../../../../../hooks/useCourseInstancesQuery"
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
import { baseTheme, headingFont } from "@/shared-module/common/styles"

const containerStyles = css`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
`

const headerContainerStyles = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2.5rem;
`

const titleStyles = css`
  font-size: clamp(2rem, 3.6vh, 36px);
  color: ${baseTheme.colors.gray[700]};
  font-family: ${headingFont};
  font-weight: bold;
  margin: 0;
`

const cardContainerStyles = css`
  display: flex;
  flex-direction: column;
  gap: 2rem;
`

const cardStyles = css`
  background: ${baseTheme.colors.primary[100]};
  border: 1px solid ${baseTheme.colors.clear[200]};
  border-radius: 0.5rem;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.2s ease;

  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }
`

const cardTitleStyles = css`
  font-size: ${baseTheme.fontSizes[3]}px;
  color: ${baseTheme.colors.gray[700]};
  font-weight: bold;
  margin: 0 0 1.5rem 0;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid ${baseTheme.colors.clear[200]};
`

const actionButtonsContainerStyles = css`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`

const buttonGroupStyles = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid ${baseTheme.colors.clear[200]};

  &:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }
`

const CourseCourseInstances: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()
  const [showDialog, setShowDialog] = useState(false)
  const getCourseInstances = useCourseInstancesQuery(courseId)

  const handleCreateNewCourseInstance = async () => {
    setShowDialog(false)
    invalidateCourseInstances(courseId)
  }

  return (
    <div className={containerStyles}>
      <div className={headerContainerStyles}>
        <h2 className={titleStyles}>{t("title-all-course-instances")}</h2>
        <Button variant="primary" size="medium" onClick={() => setShowDialog(true)}>
          {t("button-text-new")}
        </Button>
      </div>

      {getCourseInstances.isError && (
        <ErrorBanner variant={"readOnly"} error={getCourseInstances.error} />
      )}
      {getCourseInstances.isPending && <Spinner variant={"medium"} />}
      {getCourseInstances.isSuccess && (
        <div className={cardContainerStyles}>
          {getCourseInstances.data
            .sort((a, b) => parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime())
            .map((instance) => {
              const name = instance.name ?? t("default-course-instance-name")
              return (
                <div key={instance.id} className={cardStyles}>
                  <h3 className={cardTitleStyles}>{name}</h3>
                  <div className={actionButtonsContainerStyles}>
                    <div className={buttonGroupStyles}>
                      <Link href={viewCourseInstanceCompletionsPageRoute(instance.id)}>
                        <Button variant="tertiary" size="medium">
                          {t("link-view-completions")}
                        </Button>
                      </Link>
                      <Link href={viewCourseInstancePointsPageRoute(instance.id)}>
                        <Button variant="tertiary" size="medium">
                          {t("link-view-points")}
                        </Button>
                      </Link>
                    </div>

                    <div className={buttonGroupStyles}>
                      <Link href={manageCourseInstancePageRoute(instance.id)}>
                        <Button variant="secondary" size="medium">
                          {t("link-manage")}
                        </Button>
                      </Link>
                      <Link href={viewCourseInstanceCertificatesPageRoute(instance.id)}>
                        <Button variant="secondary" size="medium">
                          {t("link-manage-certificates")}
                        </Button>
                      </Link>
                      <Link href={manageCourseInstanceEmailsPageRoute(instance.id)}>
                        <Button variant="secondary" size="medium">
                          {t("link-manage-emails")}
                        </Button>
                      </Link>
                      <Link href={manageCourseInstancePermissionsPageRoute(instance.id)}>
                        <Button variant="secondary" size="medium">
                          {t("link-manage-permissions")}
                        </Button>
                      </Link>
                    </div>

                    <div className={buttonGroupStyles}>
                      <PointExportButton courseInstanceId={instance.id} courseInstanceName={name} />
                      <ModuleCompletionReprocessButton courseInstanceId={instance.id} />
                    </div>
                  </div>
                </div>
              )
            })}
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
    </div>
  )
}

export default CourseCourseInstances
