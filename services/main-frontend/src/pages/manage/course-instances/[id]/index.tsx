import { css } from "@emotion/css"
import { isPast } from "date-fns"
import { useRouter } from "next/router"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery } from "react-query"

import Layout from "../../../../components/Layout"
import NewCourseInstanceForm from "../../../../components/page-specific/manage/courses/id/new-course-instance/NewCourseInstanceForm"
import {
  deleteCourseInstance,
  editCourseInstance,
  fetchCourseInstance,
} from "../../../../services/backend/course-instances"
import { CourseInstanceForm } from "../../../../shared-module/bindings"
import { isErrorResponse } from "../../../../shared-module/bindings.guard"
import Button from "../../../../shared-module/components/Button"
import Spinner from "../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import { frontendWideWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import basePath from "../../../../shared-module/utils/base-path"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

interface ManageCourseInstancesProps {
  query: SimplifiedUrlQuery<"id">
}

const ManageCourseInstances: React.FC<ManageCourseInstancesProps> = ({ query }) => {
  const { t } = useTranslation()
  const courseInstanceId = query.id
  const router = useRouter()

  const { isLoading, error, data, refetch } = useQuery(`course-instance-${courseInstanceId}`, () =>
    fetchCourseInstance(courseInstanceId),
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const mutation = useMutation(
    async (update: CourseInstanceForm) => {
      setErrorMessage(null)
      await editCourseInstance(courseInstanceId, update)
    },
    {
      onSuccess: () => {
        refetch()
      },
      onError: (err) => {
        if (isErrorResponse(err)) {
          setErrorMessage(t("message-saving-failed"))
        } else {
          setErrorMessage(t("message-update-failed"))
        }
      },
    },
  )
  const deleteMutation = useMutation(
    async (_courseId: string) => {
      setErrorMessage(null)
      await deleteCourseInstance(courseInstanceId)
    },
    {
      onSuccess: (_, courseId) => {
        // eslint-disable-next-line i18next/no-literal-string
        router.push(`/manage/courses/${courseId}`)
      },
      onError: (err) => {
        if (err instanceof Error) {
          setErrorMessage(t("message-deleting-failed"))
        } else {
          setErrorMessage(t("message-deleting-failed"))
        }
      },
    },
  )

  if (isLoading) {
    return <Spinner variant="medium" />
  }
  if (error || !data) {
    return (
      <div>
        {t("error-title")}
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </div>
    )
  }

  let instanceInfo
  if (editing) {
    instanceInfo = (
      <NewCourseInstanceForm
        initialData={data}
        onSubmit={(data) => {
          mutation.mutate(data)
          setEditing(false)
        }}
        onCancel={() => setEditing(false)}
      />
    )
  } else {
    const supportEmail = data.support_email ? (
      <div>
        {t("support-email")}: {data.support_email}
      </div>
    ) : (
      <div>{t("no-support-email-set")}</div>
    )
    let schedule
    if (data.ends_at && isPast(data.ends_at)) {
      // instance is over
      schedule = <div>{t("instance-ended-at-time", { time: data.ends_at.toISOString() })}</div>
    } else if (data.starts_at && isPast(data.starts_at)) {
      // course is currently open
      if (data.ends_at) {
        schedule = (
          <div>{t("instance-is-open-and-ends-at-time", { time: data.ends_at.toISOString() })}</div>
        )
      } else {
        schedule = <div>{t("instance-is-currently-open-and-has-no-set-ending-time")}</div>
      }
    } else if (data.starts_at) {
      // course is not open yet
      schedule = <div>{t("instance-opens-at-time", { time: data.starts_at.toISOString() })}</div>
    } else {
      schedule = <div>{t("instance-has-no-set-opening-time")}</div>
    }
    instanceInfo = (
      <>
        <div>{data.description}</div>
        <hr />
        <div>
          {t("teacher-in-charge-name")}: {data.teacher_in_charge_name}
        </div>
        <div>
          {t("teacher-in-charge-email")}: {data.teacher_in_charge_email}
        </div>
        {supportEmail}
        <div>{t("support-email-description")}</div>
        {schedule}
        <Button variant="tertiary" size="medium" onClick={() => setEditing(true)}>
          {t("edit")}
        </Button>
        <Button
          variant="secondary"
          size="medium"
          onClick={() => deleteMutation.mutate(data.course_id)}
        >
          {t("button-text-delete")}
        </Button>
      </>
    )
  }

  return (
    <Layout frontPageUrl={basePath()} navVariant="complex">
      <div
        className={css`
          ${frontendWideWidthCenteredComponentStyles}
          margin-bottom: 1rem;
        `}
      >
        <h1>
          {t("label-course-instance")} {data.name ?? t("default-course-instance-name")} ({data.id})
        </h1>
        {errorMessage && <div>{errorMessage}</div>}
        {instanceInfo}
      </div>
    </Layout>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(ManageCourseInstances)),
)
