"use client"

import { css } from "@emotion/css"
import { QueryObserverResult, RefetchOptions, RefetchQueryFilters } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import CourseDescription from "./CourseDescription"
import EditCourseForm from "./EditCourseForm"
import UpdatePeerReviewQueueReviewsReceivedButton from "./UpdatePeerReviewQueueReviewsReceivedButton"

import ModuleCompletionReprocessButton from "@/app/manage/courses/[id]/course-instances/ModuleCompletionReprocessButton"
import {
  deleteCourse as deleteCourseFromApi,
  resetCourseProgressForEveryone,
  resetCourseProgressForTeacherThemselves,
  setCourseJoinCode,
} from "@/generated/api/sdk.generated"
import type { Course } from "@/generated/api/types.generated"
import useCourseBreadcrumbInfoQuery from "@/hooks/useCourseBreadcrumbInfoQuery"
import Button from "@/shared-module/common/components/Button"
import OnlyRenderIfPermissions from "@/shared-module/common/components/OnlyRenderIfPermissions"
import { useDialog } from "@/shared-module/common/components/dialogs/DialogProvider"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, headingFont, primaryFont, typography } from "@/shared-module/common/styles"
import { courseMaterialFrontPageHref } from "@/shared-module/common/utils/cross-routing"

interface Props {
  course: Course
  refetch: (
    options?: (RefetchOptions & RefetchQueryFilters) | undefined,
  ) => Promise<QueryObserverResult<Course, Error>>
}

const ManageCourse: React.FC<React.PropsWithChildren<Props>> = ({ course, refetch }) => {
  const { confirm } = useDialog()

  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const courseBreadcrumbInfoQuery = useCourseBreadcrumbInfoQuery(course.id)
  const organizationSlug = courseBreadcrumbInfoQuery.data?.organization_slug
  const deleteCourseMutation = useToastMutation(
    async () => {
      await deleteCourseFromApi({
        path: {
          course_id: course.id,
        },
      })
      await refetch()
    },
    {
      notify: true,

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
      await resetCourseProgressForTeacherThemselves({
        path: {
          course_id: course.id,
        },
      })
    },
    {
      notify: true,

      method: "DELETE",
    },
  )

  const teacherResetCourseProgressForEveryoneMutation = useToastMutation(
    async () => {
      await resetCourseProgressForEveryone({
        path: {
          course_id: course.id,
        },
      })
    },
    {
      notify: true,

      method: "DELETE",
    },
  )

  const handleOnUpdateCourse = async () => {
    await refetch()
  }

  const setJoinCourseLinkMutation = useToastMutation(
    async (courseId: string) => {
      await setCourseJoinCode({
        path: {
          course_id: courseId,
        },
      })
    },
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: async () => {
        await refetch()
      },
    },
  )

  return (
    <>
      <div
        className={css`
          margin-top: -1.5rem;
          margin-bottom: 1rem;
        `}
      >
        <p
          className={css`
            font-size: 1.2rem;
            color: ${baseTheme.colors.gray[700]};
            font-family: ${primaryFont};
            font-weight: 450;
            margin-top: 0.4rem;
            margin-bottom: 0.6rem;
            display: inline-block;
          `}
        >
          {t("wiki-link-text")}
          <a href="https://github.com/rage/secret-project-331/wiki"> {t("documentation")}</a>
        </p>
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
          {course.is_unlisted && ` (${t("unlisted")})`}
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
          onClick={async () => {
            const confirmation = await confirm(
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
      <Button variant="primary" size="medium" onClick={() => setShowForm(true)}>
        {t("edit")}
      </Button>
      <EditCourseForm
        course={course}
        onSubmitForm={handleOnUpdateCourse}
        open={showForm}
        onClose={() => setShowForm(false)}
      />
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
          color: ${baseTheme.colors.gray[500]};
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(400px, 100%), 1fr));
          margin: 2rem 0;
          text-align: center;
          gap: 0.5rem;
        `}
      >
        <div
          className={css`
            padding: 1rem;
            border: 3px solid ${baseTheme.colors.clear[200]};
            color: ${baseTheme.colors.gray[700]};
          `}
        >
          <p
            className={css`
              font-size: 1rem;
            `}
          >
            {t("suggest-description-card-title")}
          </p>
          <CourseDescription course={course} refetch={refetch}></CourseDescription>
        </div>
        <div
          className={css`
            border: 3px dotted ${baseTheme.colors.gray[300]};
            padding: 4.5rem 0;
          `}
        ></div>
        <div
          className={css`
            border: 3px dotted ${baseTheme.colors.gray[300]};
            padding: 4.5rem 0;
          `}
        ></div>
        <div
          className={css`
            border: 3px dotted ${baseTheme.colors.gray[300]};
            padding: 4.5rem 0;
          `}
        ></div>
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
          <div
            className={css`
              margin: 1rem 0;
            `}
          >
            <Button
              variant="secondary"
              size="medium"
              onClick={async () => {
                const sure = await confirm(
                  t("are-you-sure-you-want-to-reset-your-own-progress-on-the-course"),
                )
                if (sure) {
                  teacherResetCourseProgressForThemselvesMutation.mutate()
                }
              }}
            >
              {t("reset-my-own-progress-on-the-course")}
            </Button>
          </div>
          {course.is_draft && (
            <div
              className={css`
                margin: 1rem 0;
              `}
            >
              <Button
                variant="secondary"
                size="medium"
                onClick={async () => {
                  const sure = await confirm(
                    t("are-you-sure-you-want-to-reset-everyones-progress-on-the-course"),
                  )
                  if (sure) {
                    teacherResetCourseProgressForEveryoneMutation.mutate()
                  }
                }}
              >
                {t("reset-progress-for-all-students-on-the-course-draft")}
              </Button>
            </div>
          )}
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
                download
              >
                <Button variant="secondary" size="medium" type="button">
                  {t("link-export-submissions")}
                </Button>
              </a>
            </li>
            <li>
              <a
                href={`/api/v0/main-frontend/courses/${course.id}/export-user-details`}
                aria-label={t("link-export-user-details")}
                download
              >
                <Button variant="secondary" size="medium" type="button">
                  {t("link-export-user-details")}
                </Button>
              </a>
            </li>
            <li>
              <a
                href={`/api/v0/main-frontend/courses/${course.id}/export-exercise-tasks`}
                aria-label={t("link-export-exercise-tasks")}
                download
              >
                <Button variant="secondary" size="medium" type="button">
                  {t("link-export-exercise-tasks")}
                </Button>
              </a>
            </li>
            <li>
              <a
                href={`/api/v0/main-frontend/courses/${course.id}/export-course-instances`}
                aria-label={t("link-export-course-instances")}
                download
              >
                <Button variant="secondary" size="medium" type="button">
                  {t("link-export-course-instances")}
                </Button>
              </a>
            </li>
            <li>
              <a
                href={`/api/v0/main-frontend/courses/${course.id}/export-course-user-consents`}
                aria-label={t("link-export-course-user-consents")}
                download
              >
                <Button variant="secondary" size="medium" type="button">
                  {t("link-export-course-user-consents")}
                </Button>
              </a>
            </li>
            <li>
              <a
                href={`/api/v0/main-frontend/courses/${course.id}/export-user-exercise-states`}
                aria-label={t("link-export-user-exercise-states")}
                download
              >
                <Button variant="secondary" size="medium" type="button">
                  {t("link-export-user-exercise-states")}
                </Button>
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
      {course.is_joinable_by_code_only && (
        <div>
          {/*eslint-disable-next-line i18next/no-literal-string */}
          <a href={`/join?code=${course.join_code}`}>{`/join?code=${course.join_code}`}</a>
          <div>
            <Button
              variant={"secondary"}
              size={"small"}
              onClick={() => setJoinCourseLinkMutation.mutate(course.id)}
            >
              {t("button-text-generate-join-course-link")}
            </Button>
          </div>
        </div>
      )}
      <ModuleCompletionReprocessButton courseId={course.id} />
    </>
  )
}

export default ManageCourse
