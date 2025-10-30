"use client"
import { css } from "@emotion/css"
import { useContext, useState } from "react"
import { useTranslation } from "react-i18next"

import PageContext from "@/contexts/course-material/PageContext"
import useCourseInfo from "@/hooks/course-material/useCourseInfo"
import useOrganization from "@/hooks/course-material/useOrganization"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import { baseTheme } from "@/shared-module/common/styles"
import { navigateToCourseRoute } from "@/shared-module/common/utils/routes"

const ClosedCourseWarningDialog = () => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(true)

  const pageContext = useContext(PageContext)
  const course = pageContext.course

  const successorCourse = useCourseInfo(course?.closed_course_successor_id)
  const organization = useOrganization(successorCourse?.data?.organization_id)

  if (successorCourse.isError || organization.isError) {
    return <ErrorBanner error={successorCourse.error || organization.error} />
  }

  if (!course) {
    return null
  }

  return (
    <StandardDialog
      open={open}
      closeable
      showCloseButton
      title={t("course-closed-warning-title")}
      onClose={() => setOpen(false)}
    >
      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          line-height: 1.55;
        `}
      >
        <p
          className={css`
            margin: 0;
          `}
        >
          {t("course-closed-warning-message")}
        </p>

        {course.closed_additional_message && (
          <div
            className={css`
              margin-top: 0.25rem;
              padding: 0.75rem 1rem;
              background-color: ${baseTheme.colors.yellow[100]};
              border-left: 4px solid ${baseTheme.colors.yellow[600]};
              border-radius: 8px;
            `}
          >
            <span
              className={css`
                display: inline-block;
                align-self: flex-start;
                padding: 0.125rem 0.5rem;
                border-radius: 999px;
                background-color: ${baseTheme.colors.yellow[600]};
                color: ${baseTheme.colors.gray[600]};
                font-weight: 700;
                text-transform: uppercase;
                font-size: 12px;
                letter-spacing: 0.02em;
                margin-bottom: 0.5rem;
              `}
            >
              {t("course-closed-additional-label")}
            </span>
            <p
              className={css`
                margin: 0;
              `}
            >
              {course.closed_additional_message}
            </p>
          </div>
        )}

        {(successorCourse.isLoading || organization.isLoading) && (
          <div
            className={css`
              margin: 1rem 0;
            `}
          >
            <Spinner />
          </div>
        )}

        {successorCourse.data && organization.data && (
          <a
            className={css`
              margin: 1rem 0;
            `}
            href={navigateToCourseRoute(organization.data?.slug, successorCourse.data.slug)}
          >
            <Button variant="primary" size="medium">
              {t("course-closed-warning-successor-button")}
            </Button>
          </a>
        )}
      </div>
    </StandardDialog>
  )
}

export default ClosedCourseWarningDialog
