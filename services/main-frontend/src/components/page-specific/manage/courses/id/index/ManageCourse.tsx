import { css } from "@emotion/css"
import { Dialog } from "@mui/material"
import { QueryObserverResult, RefetchOptions, RefetchQueryFilters } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import useCourseBreadcrumbInfoQuery from "../../../../../../hooks/useCourseBreadcrumbInfoQuery"
import { deleteCourse } from "../../../../../../services/backend/courses"
import { Course } from "../../../../../../shared-module/bindings"
import Button from "../../../../../../shared-module/components/Button"
import OnlyRenderIfPermissions from "../../../../../../shared-module/components/OnlyRenderIfPermissions"
import useToastMutation from "../../../../../../shared-module/hooks/useToastMutation"
import { baseTheme, headingFont, typography } from "../../../../../../shared-module/styles"
import { courseMaterialFrontPageHref } from "../../../../../../shared-module/utils/cross-routing"

import UpdateCourseForm from "./UpdateCourseForm"
import UpdatePeerReviewQueueReviewsReceivedButton from "./UpdatePeerReviewQueueReviewsReceivedButton"

interface Props {
  course: Course
  refetch: (
    options?: (RefetchOptions & RefetchQueryFilters<unknown>) | undefined,
  ) => Promise<QueryObserverResult<Course, unknown>>
}

const ManageCourse: React.FC<React.PropsWithChildren<Props>> = ({ course, refetch }) => {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const courseBreadcrumbInfoQuery = useCourseBreadcrumbInfoQuery(course.id)
  const organizationSlug = courseBreadcrumbInfoQuery.data?.organization_slug
  const deleteCourseMutation = useToastMutation(
    async () => {
      await deleteCourse(course.id)
      await refetch()
    },
    {
      notify: true,
      // eslint-disable-next-line i18next/no-literal-string
      method: "DELETE",
    },
    {
      onSuccess: async () => {
        await refetch()
      },
    },
  )

  const handleOnUpdateCourse = async () => {
    setShowForm(!showForm)
    await refetch()
  }

  return (
    <>
      <div
        className={css`
          margin-top: -1.5rem;
          margin-bottom: 1rem;
        `}
      >
        <h1
          className={css`
            font-size: ${typography.h4};
            color: ${baseTheme.colors.gray[700]};
            font-family: ${headingFont};
            font-weight: bold;
          `}
        >
          {course.name}
          {course.is_draft && ` (${t("draft")})`}
          {course.deleted_at && ` (${t("deleted")})`}
        </h1>
        <p>
          <b>{t("text-field-label-description")}</b>: {course.description}
        </p>
      </div>
      <OnlyRenderIfPermissions
        action={{
          type: "usually_unacceptable_deletion",
        }}
        resource={{
          type: "course",
          id: course.id,
        }}
      >
        <Button
          variant="secondary"
          size="medium"
          onClick={() => {
            const confirmation = confirm(
              // eslint-disable-next-line i18next/no-literal-string
              `${t("delete-course-confirmation")}\n\n${t(
                "delete-course-confirmation-explanation",
              )}`,
            )
            if (confirmation) {
              deleteCourseMutation.mutate()
            }
          }}
        >
          {t("button-text-delete")}
        </Button>
      </OnlyRenderIfPermissions>
      <Button variant="primary" size="medium" onClick={() => setShowForm(!showForm)}>
        {t("edit")}
      </Button>
      <Dialog open={showForm} onClose={() => setShowForm(!showForm)}>
        <div
          className={css`
            margin: 1rem;
          `}
        >
          <Button variant="primary" size="medium" onClick={() => setShowForm(!showForm)}>
            {t("button-text-close")}
          </Button>
          <UpdateCourseForm
            courseId={course.id}
            courseName={course.name}
            courseDescription={course.description}
            isDraft={course.is_draft}
            isTest={course.is_test_mode}
            onSubmitForm={handleOnUpdateCourse}
          />
        </div>
      </Dialog>
      {organizationSlug && (
        <div
          className={css`
            margin: 1rem 0;
          `}
        >
          <a href={courseMaterialFrontPageHref(organizationSlug, course.slug)}>
            <Button variant="secondary" size="medium">
              {t("button-text-open-course-front-page")}
            </Button>
          </a>
        </div>
      )}
      <div
        className={css`
          border: 3px dotted ${baseTheme.colors.gray[300]};
          color: ${baseTheme.colors.gray[500]};
          padding: 20rem 0;
          margin: 2rem 0;
          text-align: center;
        `}
      >
        <p>{t("placeholder-text-reserved-for-course-overview")}</p>
      </div>
      <UpdatePeerReviewQueueReviewsReceivedButton courseId={course.id} />
    </>
  )
}

export default ManageCourse
