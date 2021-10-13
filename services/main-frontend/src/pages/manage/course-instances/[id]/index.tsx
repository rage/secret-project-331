import { css } from "@emotion/css"
import { TextField } from "@material-ui/core"
import { DateTimePicker, LocalizationProvider } from "@material-ui/lab"
import AdapterDateFns from "@material-ui/lab/AdapterDateFns"
import { isPast } from "date-fns"
import { useRouter } from "next/router"
import React, { useState } from "react"
import { useMutation, useQuery } from "react-query"

import Layout from "../../../../components/Layout"
import {
  deleteCourseInstance,
  editCourseInstance,
  fetchCourseInstance,
} from "../../../../services/backend/course-instances"
import { CourseInstanceUpdate } from "../../../../shared-module/bindings"
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
  const [newName, setNewName] = useState<string>("")
  const [newDescription, setNewDescription] = useState<string>("")
  const [newSupportEmail, setNewSupportEmail] = useState<string>("")
  const [newTeacherInChargeName, setNewTeacherInChargeName] = useState<string>("")
  const [newTeacherInChargeEmail, setNewTeacherInChargeEmail] = useState<string>("")
  const [newOpeningTime, setNewOpeningTime] = useState<Date | null>(null)
  const [newClosingTime, setNewClosingTime] = useState<Date | null>(null)
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

  function submit() {
    if (!newTeacherInChargeName || newTeacherInChargeName.length === 0) {
      setErrorMessage("Teacher-in-charge name cannot be empty")
      return
    }
    if (!newTeacherInChargeEmail || newTeacherInChargeEmail.length === 0) {
      setErrorMessage("Teacher-in-charge email cannot be empty")
      return
    }
    // treat empty strings as null
    mutation.mutate({
      name: newName || null,
      description: newDescription || null,
      support_email: newSupportEmail || null,
      teacher_in_charge_name: newTeacherInChargeName,
      teacher_in_charge_email: newTeacherInChargeEmail,
      opening_time: newOpeningTime,
      closing_time: newClosingTime,
    })
    setEditing(false)
  }

  let instanceInfo
  if (editing) {
    instanceInfo = (
      <>
        <label htmlFor="name">Name</label> <br />
        <TextField
          id="name"
          value={newName}
          onChange={(ev) => setNewName(ev.currentTarget.value)}
        ></TextField>
        <br />
        <label htmlFor="description">Description</label> <br />
        <TextField
          id="description"
          value={newDescription}
          onChange={(ev) => setNewDescription(ev.currentTarget.value)}
        ></TextField>
        <br />
        <label htmlFor="support-email">Support email</label> <br />
        <TextField
          id="support-email"
          value={newSupportEmail}
          onChange={(ev) => setNewSupportEmail(ev.currentTarget.value)}
        ></TextField>
        <br />
        <label htmlFor="teacher-name">Teacher-in-charge name</label> <br />
        <TextField
          id="teacher-name"
          value={newTeacherInChargeName}
          onChange={(ev) => setNewTeacherInChargeName(ev.currentTarget.value)}
        ></TextField>
        <br />
        <label htmlFor="teacher-email">Teacher-in-charge email</label> <br />
        <TextField
          id="teacher-email"
          value={newTeacherInChargeEmail}
          onChange={(ev) => setNewTeacherInChargeEmail(ev.currentTarget.value)}
        ></TextField>
        <br />
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DateTimePicker
            label={"Opening time"}
            inputFormat={"dd/MM/yyyy HH:mm"}
            renderInput={(props) => <TextField {...props} />}
            value={newOpeningTime}
            onChange={(time) => {
              setNewOpeningTime(time)
            }}
          />
          <br />
          <DateTimePicker
            label={"Closing time"}
            inputFormat={"dd/MM/yyyy HH:mm"}
            renderInput={(props) => <TextField {...props} />}
            value={newClosingTime}
            onChange={(time) => {
              setNewClosingTime(time)
            }}
          />
        </LocalizationProvider>
        <br />
        <Button
          variant="primary"
          size="medium"
          onClick={submit}
          disabled={newTeacherInChargeName.length === 0 || newTeacherInChargeEmail.length === 0}
        >
          Save
        </Button>
        <Button variant="secondary" size="medium" onClick={() => setEditing(false)}>
          Cancel
        </Button>
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
            setNewName(data.name || "")
            setNewDescription(data.description || "")
            setNewTeacherInChargeName(data.teacher_in_charge_name)
            setNewTeacherInChargeEmail(data.teacher_in_charge_email)
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
