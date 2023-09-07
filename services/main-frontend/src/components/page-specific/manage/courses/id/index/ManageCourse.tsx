import { css } from "@emotion/css"
import { QueryObserverResult, RefetchOptions, RefetchQueryFilters } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import useCourseBreadcrumbInfoQuery from "../../../../../../hooks/useCourseBreadcrumbInfoQuery"
import {
  deleteCourse,
  teacherResetCourseProgressForThemselves,
} from "../../../../../../services/backend/courses"
import { Course } from "../../../../../../shared-module/bindings"
import Button from "../../../../../../shared-module/components/Button"
import Dialog from "../../../../../../shared-module/components/Dialog"
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

  const teacherResetCourseProgressForThemselvesMutation = useToastMutation(
    async () => {
      await teacherResetCourseProgressForThemselves(course.id)
    },
    {
      notify: true,
      // eslint-disable-next-line i18next/no-literal-string
      method: "DELETE",
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
      <Dialog open={showForm} noPadding={true}>
        <div
          className={css`
            margin: 1rem;
            display: flex;
            flex-direction: column;
          `}
        >
          <div>
            <Button variant="primary" size="medium" onClick={() => setShowForm(!showForm)}>
              {t("button-text-close")}
            </Button>
          </div>

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

      <OnlyRenderIfPermissions
        action={{
          type: "teach",
        }}
        resource={{
          type: "course",
          id: course.id,
        }}
      >
        <>
          <UpdatePeerReviewQueueReviewsReceivedButton courseId={course.id} />
          <Button
            variant="secondary"
            size="medium"
            onClick={() => {
              const sure = confirm(
                t("are-you-sure-you-want-to-reset-your-own-progress-on-the-course"),
              )
              if (sure) {
                teacherResetCourseProgressForThemselvesMutation.mutate()
              }
            }}
          >
            {t("reset-my-own-progress-on-the-course")}
          </Button>
          <ul
            className={css`
              list-style-type: none;
              padding-left: 0;
            `}
          >
            <li>
              <a
                href={`/api/v0/main-frontend/courses/${course.id}/export-submissions`}
                aria-label={t("link-export-submissions")}
              >
                {t("link-export-submissions")}
              </a>
            </li>
            <li>
              <a
                href={`/api/v0/main-frontend/courses/${course.id}/export-user-details`}
                aria-label={t("link-export-user-details")}
              >
                {t("link-export-user-details")}
              </a>
            </li>
            <li>
              <a
                href={`/api/v0/main-frontend/courses/${course.id}/export-exercise-tasks`}
                aria-label={t("link-export-exercise-tasks")}
              >
                {t("link-export-exercise-tasks")}
              </a>
            </li>
            <li>
              <a
                href={`/api/v0/main-frontend/courses/${course.id}/export-course-instances`}
                aria-label={t("link-export-course-instances")}
              >
                {t("link-export-course-instances")}
              </a>
            </li>
          </ul>
        </>
      </OnlyRenderIfPermissions>
      <OnlyRenderIfPermissions action={{ type: "edit" }} resource={{ type: "global_permissions" }}>
        <a
          href={`/cms/courses/${course.id}/research-form-edit`}
          aria-label={t("button-text-create-or-edit-research-form")}
        >
          <Button variant="secondary" size="medium">
            {t("button-text-create-or-edit-research-form")}
          </Button>
        </a>
      </OnlyRenderIfPermissions>
    </>
  )
}

export default ManageCourse
