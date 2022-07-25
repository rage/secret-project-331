import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { isPast } from "date-fns"
import { useRouter } from "next/router"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../../../components/Layout"
import NewCourseInstanceForm from "../../../../components/page-specific/manage/courses/id/course-instances/NewCourseInstanceForm"
import {
  deleteCourseInstance,
  editCourseInstance,
  fetchCourseInstance,
} from "../../../../services/backend/course-instances"
import { CourseInstanceForm } from "../../../../shared-module/bindings"
import Button from "../../../../shared-module/components/Button"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import useToastMutation from "../../../../shared-module/hooks/useToastMutation"
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

  const getCourseInstances = useQuery([`course-instance-${courseInstanceId}`], () =>
    fetchCourseInstance(courseInstanceId))
  const [editing, setEditing] = useState(false)
  const mutation = useToastMutation(
    async (update: CourseInstanceForm) => {
      await editCourseInstance(courseInstanceId, update)
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
      await deleteCourseInstance(courseInstanceId)
    },
    {
      notify: true,
      method: "DELETE",
    },
    {
      onSuccess: (_, courseId) => {
        // eslint-disable-next-line i18next/no-literal-string
        router.push(`/manage/courses/${courseId}`)
      },
    },
  )

  let instanceInfo
  if (getCourseInstances.isSuccess) {
    const data = getCourseInstances.data
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
            <div>
              {t("instance-is-open-and-ends-at-time", { time: data.ends_at.toISOString() })}
            </div>
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
  }

  return (
    <Layout navVariant="simple">
      <div
        className={css`
          margin-bottom: 1rem;
        `}
      >
        <h1>
          {t("label-course-instance")}{" "}
          {getCourseInstances.data?.name ?? t("default-course-instance-name")} (
          {getCourseInstances.isSuccess && getCourseInstances.data.id})
        </h1>
        {mutation.isError && <ErrorBanner variant={"readOnly"} error={mutation.error} />}
        {deleteMutation.isError && (
          <ErrorBanner variant={"readOnly"} error={deleteMutation.error} />
        )}
        {getCourseInstances.isError && (
          <ErrorBanner variant={"readOnly"} error={getCourseInstances.error} />
        )}
        {(getCourseInstances.isLoading || getCourseInstances.isIdle) && (
          <Spinner variant={"medium"} />
        )}
        {getCourseInstances.isSuccess && instanceInfo}
      </div>
    </Layout>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(ManageCourseInstances)),
)
