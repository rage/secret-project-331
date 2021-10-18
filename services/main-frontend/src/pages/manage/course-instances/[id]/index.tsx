import { css } from "@emotion/css"
import { TextField } from "@material-ui/core"
import { DateTimePicker, LocalizationProvider } from "@material-ui/lab"
import AdapterDateFns from "@material-ui/lab/AdapterDateFns"
import { isPast } from "date-fns"
import { useRouter } from "next/router"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQuery } from "react-query"

import Layout from "../../../../components/Layout"
import {
  deleteCourseInstance,
  editCourseInstance,
  fetchCourseInstance,
} from "../../../../services/backend/course-instances"
import { CourseInstanceUpdate, ErrorResponse } from "../../../../shared-module/bindings"
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

interface Fields {
  name: string
  description: string
  supportEmail: string
  teacherName: string
  teacherEmail: string
}

const ManageCourseInstances: React.FC<ManageCourseInstancesProps> = ({ query }) => {
  const courseInstanceId = query.id
  const router = useRouter()
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm<Fields>()
  const { isLoading, error, data, refetch } = useQuery(`course-instance-${courseInstanceId}`, () =>
    fetchCourseInstance(courseInstanceId),
  )
  const [newOpeningTime, setNewOpeningTime] = useState<Date | null>(null)
  const [newClosingTime, setNewClosingTime] = useState<Date | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const mutation = useMutation(
    async (update: CourseInstanceUpdate) => {
      setErrorMessage(null)
      await editCourseInstance(courseInstanceId, update)
    },
    {
      onSuccess: () => {
        refetch()
      },
      onError: (err) => {
        if (err instanceof Error) {
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
  const onSubmit = handleSubmit((data) => {
    console.log(data)
    mutation.mutate({
      name: data.name || null,
      description: data.description || null,
      support_email: data.supportEmail || null,
      teacher_in_charge_name: data.teacherName,
      teacher_in_charge_email: data.teacherEmail,
      opening_time: newOpeningTime,
      closing_time: newClosingTime,
    })
    setEditing(false)
  })

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

  const field = (
    id: "name" | "description" | "supportEmail" | "teacherName" | "teacherEmail",
    placeholder: string,
    defaultValue: string,
    required: boolean,
  ) => {
    return (
      <>
        <label htmlFor={id}>{placeholder}</label>
        <br />
        {required && errors[id] && (
          <>
            <span>This field is required</span>
            <br />
          </>
        )}
        <input
          id={id}
          placeholder={placeholder}
          defaultValue={defaultValue}
          {...register(id, { required })}
        ></input>
        <br />
      </>
    )
  }

  let instanceInfo
  if (editing) {
    instanceInfo = (
      <>
        <form onSubmit={onSubmit}>
          {field("name", "Instance name", data.name || "", false)}
          {field("description", "Instance description", data.description || "", false)}
          {field("supportEmail", "Support email", data.support_email || "", false)}
          {field("teacherName", "Teacher-in-charge name", data.teacher_in_charge_name || "", true)}
          {field(
            "teacherEmail",
            "Teacher-in-charge email",
            data.teacher_in_charge_email || "",
            true,
          )}

          <br />
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DateTimePicker
              label={"Opening time"}
              inputFormat={"dd/MM/yyyy HH:mm"}
              renderInput={(props) => <TextField {...props} />}
              value={newOpeningTime}
              onChange={(time) => setNewOpeningTime(time)}
            />
            <br />
            <br />
            <DateTimePicker
              label={"Closing time"}
              inputFormat={"dd/MM/yyyy HH:mm"}
              renderInput={(props) => <TextField {...props} />}
              value={newClosingTime}
              onChange={(time) => setNewClosingTime(time)}
            />
          </LocalizationProvider>
          <br />
          <Button variant="primary" size="medium" type="submit" value="Submit">
            Submit
          </Button>
          <Button variant="secondary" size="medium" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      </>
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
        <Button
          variant="tertiary"
          size="medium"
          onClick={() => {
            reset()
            setNewOpeningTime(data.starts_at)
            setNewClosingTime(data.ends_at)
            setEditing(true)
          }}
        >
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
