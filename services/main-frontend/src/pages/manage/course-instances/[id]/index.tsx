import { css } from "@emotion/css"
import { isPast } from "date-fns"
import { useRouter } from "next/router"
import React, { useState } from "react"
import { useMutation, useQuery } from "react-query"

import Layout from "../../../../components/Layout"
import Form from "../../../../components/forms/CourseInstanceForm"
import {
  deleteCourseInstance,
  editCourseInstance,
  fetchCourseInstance,
} from "../../../../services/backend/course-instances"
import { CourseInstanceForm } from "../../../../shared-module/bindings"
import { isErrorResponse } from "../../../../shared-module/bindings.guard"
import Button from "../../../../shared-module/components/Button"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import { wideWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import basePath from "../../../../shared-module/utils/base-path"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

interface ManageCourseInstancesProps {
  query: SimplifiedUrlQuery<"id">
}

const ManageCourseInstances: React.FC<ManageCourseInstancesProps> = ({ query }) => {
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
          setErrorMessage(`Failed to update course instance: ${err.message}`)
        } else {
          setErrorMessage(`Unexpected error while updating course instance: ${JSON.stringify(err)}`)
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
        router.push(`/manage/courses/${courseId}`)
      },
      onError: (err) => {
        if (err instanceof Error) {
          setErrorMessage(`Failed to delete course instance: ${err.toString()}`)
        } else {
          setErrorMessage(`Unexpected error while deleting course instance: ${JSON.stringify(err)}`)
        }
      },
    },
  )

  if (isLoading) {
    return <div>Loading...</div>
  }
  if (error || !data) {
    return (
      <div>
        Failed to fetch course instance...
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </div>
    )
  }

  let instanceInfo
  if (editing) {
    instanceInfo = (
      <Form
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
      <div>Support email: {data.support_email}</div>
    ) : (
      <div>No support email set</div>
    )
    let schedule
    if (data.ends_at && isPast(data.ends_at)) {
      // instance is over
      schedule = <div>Instance ended at {data.ends_at.toISOString()}</div>
    } else if (data.starts_at && isPast(data.starts_at)) {
      // course is currently open
      if (data.ends_at) {
        schedule = <div>Instance is open and ends at {data.ends_at.toISOString()}</div>
      } else {
        schedule = <div>Instance is currently open and has no set ending time</div>
      }
    } else if (data.starts_at) {
      // course is not open yet
      schedule = <div>Instance opens at {data.starts_at.toISOString()}</div>
    } else {
      schedule = <div>Instance has no set opening time</div>
    }
    instanceInfo = (
      <>
        <h2>{data.name}</h2>
        <div>{data.description}</div>
        <hr />
        <div>Teacher-in-charge name: {data.teacher_in_charge_name}</div>
        <div>Teacher-in-charge email: {data.teacher_in_charge_email}</div>
        {supportEmail}
        <div>
          Support emails are sent to this address if it is set, and to the teacher-in-charge email
          otherwise
        </div>
        {schedule}
        <Button variant="tertiary" size="medium" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button
          variant="secondary"
          size="medium"
          onClick={() => deleteMutation.mutate(data.course_id)}
        >
          Delete
        </Button>
      </>
    )
  }

  return (
    <Layout frontPageUrl={basePath()} navVariant="complex">
      <div
        className={css`
          ${wideWidthCenteredComponentStyles}
          margin-bottom: 1rem;
        `}
      >
        <h1>
          Course instance {data.name ?? "default"} ({data.id})
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
