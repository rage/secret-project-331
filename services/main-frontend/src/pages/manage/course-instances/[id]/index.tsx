import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { isPast, parseISO } from "date-fns"
import { useRouter } from "next/router"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import NewCourseInstanceForm from "../../../../components/page-specific/manage/courses/id/course-instances/NewCourseInstanceForm"
import {
  deleteCourseInstance,
  editCourseInstance,
  fetchCourseInstance,
  generateJoinCourseLinkForCourseInstance,
} from "../../../../services/backend/course-instances"

import { CourseInstanceForm } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export interface ManageCourseInstancesProps {
  query: SimplifiedUrlQuery<"id">
}

const ManageCourseInstances: React.FC<React.PropsWithChildren<ManageCourseInstancesProps>> = ({
  query,
}) => {
  const { t } = useTranslation()
  const courseInstanceId = query.id
  const router = useRouter()

  const getCourseInstances = useQuery({
    queryKey: [`course-instance-${courseInstanceId}`],
    queryFn: () => fetchCourseInstance(courseInstanceId),
  })
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

  const generateJoinCourseLinkMutation = useToastMutation(
    async (_courseId: string) => {
      await generateJoinCourseLinkForCourseInstance(courseInstanceId)
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
        schedule = (
          <div>{t("instance-ended-at-time", { time: parseISO(data.ends_at).toISOString() })}</div>
        )
      } else if (data.starts_at && isPast(data.starts_at)) {
        // course is currently open
        if (data.ends_at) {
          schedule = (
            <div>
              {t("instance-is-open-and-ends-at-time", {
                time: parseISO(data.ends_at).toISOString(),
              })}
            </div>
          )
        } else {
          schedule = <div>{t("instance-is-currently-open-and-has-no-set-ending-time")}</div>
        }
      } else if (data.starts_at) {
        // course is not open yet
        schedule = (
          <div>{t("instance-opens-at-time", { time: parseISO(data.starts_at).toISOString() })}</div>
        )
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

          <div>{data.join_code}</div>
          <div>
            <Button
              variant={"primary"}
              size={"small"}
              onClick={() => generateJoinCourseLinkMutation.mutate(data.course_id)}
            >
              {t("button-text-generate-join-course-link")}
            </Button>
          </div>
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
      {deleteMutation.isError && <ErrorBanner variant={"readOnly"} error={deleteMutation.error} />}
      {getCourseInstances.isError && (
        <ErrorBanner variant={"readOnly"} error={getCourseInstances.error} />
      )}
      {getCourseInstances.isPending && <Spinner variant={"medium"} />}
      {getCourseInstances.isSuccess && instanceInfo}
    </div>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(ManageCourseInstances)),
)
