"use client"

import { css, cx } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { isPast } from "date-fns"
import { useParams, useRouter } from "next/navigation"
import React, { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import NewCourseInstanceForm, {
  NEW_COURSE_INSTANCE_FORM_ID,
} from "@/app/(layout)/manage/courses/[id]/course-instances/NewCourseInstanceForm"
import { pageTitleCss } from "@/components/credit-registration/styles"
import { getCourseInstanceOptions } from "@/generated/api/@tanstack/react-query.generated"
import { deleteCourseInstance, editCourseInstance } from "@/generated/api/sdk.generated"
import type { CourseInstanceForm } from "@/generated/api/types.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { isAppApiError } from "@/shared-module/common/errors/AppApiError"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { manageCourseRoute } from "@/shared-module/common/utils/routes"
import { dateToString } from "@/shared-module/common/utils/time"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button, QueryResult, ErrorNotice, useToggleFocus } from "@/shared-module/components"
import { inlineMetadataListCss } from "@/styles/sharedStyles"

/** The shared form renders no submit button, since its dialog caller puts one in the footer. */
const editActionsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-4);
`

const detailsCss = css`
  display: grid;
  gap: var(--space-2);
  width: 100%;

  hr {
    width: 100%;
    margin: var(--space-2) 0;
    border: none;
    border-top: 1px solid var(--color-clear-300);
  }
`

const viewActionsCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-4);
`

const ManageCourseInstances: React.FC = () => {
  const { t } = useTranslation()
  const { id: courseInstanceId } = useParams<{ id: string }>()
  const router = useRouter()

  const getCourseInstances = useQuery({
    ...getCourseInstanceOptions({
      path: {
        course_instance_id: courseInstanceId,
      },
    }),
  })
  const [editing, setEditing] = useState(false)
  const formRef = useRef<HTMLDivElement | null>(null)
  const editButtonRef = useToggleFocus(editing, () =>
    formRef.current?.querySelector("input")?.focus(),
  )
  const mutation = useToastMutation(
    async (update: CourseInstanceForm) => {
      await editCourseInstance({
        body: update,
        path: {
          course_instance_id: courseInstanceId,
        },
      })
    },
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: () => {
        getCourseInstances.refetch()
      },
    },
  )
  const deleteMutation = useToastMutation(
    async (_courseId: string) => {
      await deleteCourseInstance({
        path: {
          course_instance_id: courseInstanceId,
        },
      })
    },
    {
      notify: true,
      method: "DELETE",
    },
    {
      onSuccess: (_, courseId) => {
        router.push(manageCourseRoute(courseId))
      },
    },
  )

  return (
    <div
      className={css`
        margin-bottom: 1rem;
      `}
    >
      <h1
        className={cx(
          pageTitleCss,
          css`
            margin-bottom: var(--space-4);
          `,
        )}
      >
        {t("label-course-instance")}{" "}
        {getCourseInstances.data?.name ?? t("default-course-instance-name")}
      </h1>
      {/* notify:true already announces these errors via the toast; the banners are just the persistent copy */}
      {mutation.isError && (
        // oxlint-disable-next-line i18next/no-literal-string -- "off" is an ErrorNoticeAnnouncement enum value, not UI text
        <ErrorNotice error={mutation.error} announce="off" />
      )}
      {deleteMutation.isError && (
        // oxlint-disable-next-line i18next/no-literal-string -- "off" is an ErrorNoticeAnnouncement enum value, not UI text
        <ErrorNotice error={deleteMutation.error} announce="off" />
      )}
      <QueryResult query={getCourseInstances}>
        {(data) => {
          if (editing) {
            return (
              <>
                <div ref={formRef}>
                  <NewCourseInstanceForm
                    initialData={data}
                    serverIssues={isAppApiError(mutation.error) ? mutation.error.issues : []}
                    onSubmit={(formData) => {
                      mutation.mutate(formData, { onSuccess: () => setEditing(false) })
                    }}
                  />
                </div>
                <div className={editActionsCss}>
                  <Button variant="secondary" size="medium" onClick={() => setEditing(false)}>
                    {t("button-text-cancel")}
                  </Button>
                  <Button
                    variant="primary"
                    size="medium"
                    type="submit"
                    domProps={{ form: NEW_COURSE_INSTANCE_FORM_ID }}
                  >
                    {t("button-text-submit")}
                  </Button>
                </div>
              </>
            )
          }
          const supportEmail = data.support_email ? (
            <>
              <dt>{t("support-email")}:</dt> <dd>{data.support_email}</dd>
            </>
          ) : (
            <dd>{t("no-support-email-set")}</dd>
          )
          let schedule
          if (data.ends_at && isPast(data.ends_at)) {
            // instance is over
            schedule = (
              <div>{t("instance-ended-at-time", { time: dateToString(data.ends_at) })}</div>
            )
          } else if (data.starts_at && isPast(data.starts_at)) {
            // course is currently open
            if (data.ends_at) {
              schedule = (
                <div>
                  {t("instance-is-open-and-ends-at-time", {
                    time: dateToString(data.ends_at),
                  })}
                </div>
              )
            } else {
              schedule = <div>{t("instance-is-currently-open-and-has-no-set-ending-time")}</div>
            }
          } else if (data.starts_at) {
            // course is not open yet
            schedule = (
              <div>{t("instance-opens-at-time", { time: dateToString(data.starts_at) })}</div>
            )
          } else {
            schedule = <div>{t("instance-has-no-set-opening-time")}</div>
          }
          return (
            <div className={detailsCss}>
              <div>{data.description}</div>
              <hr />
              <dl className={inlineMetadataListCss}>
                <dt>{t("teacher-in-charge-name")}:</dt> <dd>{data.teacher_in_charge_name}</dd>
                <dt>{t("teacher-in-charge-email")}:</dt> <dd>{data.teacher_in_charge_email}</dd>
                {supportEmail}
              </dl>
              <div>{t("support-email-description")}</div>
              {schedule}
              <div className={viewActionsCss}>
                <Button
                  ref={editButtonRef}
                  variant="tertiary"
                  size="medium"
                  onClick={() => setEditing(true)}
                >
                  {t("edit")}
                </Button>
                <Button
                  variant="secondary"
                  size="medium"
                  onClick={() => deleteMutation.mutate(data.course_id)}
                >
                  {t("button-text-delete")}
                </Button>
              </div>
            </div>
          )
        }}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(ManageCourseInstances))
