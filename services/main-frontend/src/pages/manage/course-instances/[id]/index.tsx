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
  editContactInfo,
  editSchedule,
  fetchCourseInstance,
} from "../../../../services/backend/course-instances"
import Button from "../../../../shared-module/components/Button"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
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

  const [editingSupervisor, setEditingSupervisor] = useState(false)
  const [newContactEmail, setNewContactEmail] = useState<string | null>(null)
  const [newSupervisorName, setNewSupervisorName] = useState<string | null>(null)
  const [newSupervisorEmail, setNewSupervisorEmail] = useState<string | null>(null)
  const supervisorMutation = useMutation(
    async (update: {
      instanceId: string
      contactEmail: string | null
      supervisorName: string | null
      supervisorEmail: string | null
    }) => {
      setErrorMessage(null)
      await editContactInfo(
        update.instanceId,
        update.contactEmail,
        update.supervisorName,
        update.supervisorEmail,
      )
    },
    {
      onSuccess: () => {
        refetch()
      },
      onError: (err) => {
        if (err instanceof Object) {
          setErrorMessage(`Failed to update supervisor information: ${err.toString()}`)
        } else {
          setErrorMessage(
            `Unexpected error while updating supervisor information: ${JSON.stringify(err)}`,
          )
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
        if (err instanceof Object) {
          setErrorMessage(`Failed to update supervisor information: ${err.toString()}`)
        } else {
          setErrorMessage(
            `Unexpected error while updating supervisor information: ${JSON.stringify(err)}`,
          )
        }
      },
    },
  )

  const [editingSchedule, setEditingSchedule] = useState(false)
  const [newOpeningTime, setNewOpeningTime] = useState<Date | null>(null)
  const [newClosingTime, setNewClosingTime] = useState<Date | null>(null)
  const scheduleMutation = useMutation(
    async (update: {
      instanceId: string
      newOpeningTime: Date | null
      newClosingTime: Date | null
    }) => {
      setErrorMessage(null)
      await editSchedule(update.instanceId, update.newOpeningTime, update.newClosingTime)
    },
    {
      onSuccess: () => {
        refetch()
      },
      onError: (err) => {
        if (err instanceof Object) {
          setErrorMessage(`Failed to update supervisor information: ${err.toString()}`)
        } else {
          setErrorMessage(
            `Unexpected error while updating supervisor information: ${JSON.stringify(err)}`,
          )
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

  let supervisorInfo
  if (editingSupervisor) {
    supervisorInfo = (
      <>
        <label htmlFor="contact email">Contact email</label> <br />
        <TextField
          id="contact email"
          value={newContactEmail}
          onChange={(ev) => setNewContactEmail(ev.currentTarget.value)}
        ></TextField>{" "}
        <br />
        <label htmlFor="supervisor name">Supervisor name</label> <br />
        <TextField
          id="supervisor name"
          value={newSupervisorName}
          onChange={(ev) => setNewSupervisorName(ev.currentTarget.value)}
        ></TextField>{" "}
        <br />
        <label htmlFor="supervisor email">Supervisor email</label> <br />
        <TextField
          id="supervisor email"
          value={newSupervisorEmail}
          onChange={(ev) => setNewSupervisorEmail(ev.currentTarget.value)}
        ></TextField>{" "}
        <br />
        <Button
          variant="primary"
          size="medium"
          onClick={() => {
            supervisorMutation.mutate({
              instanceId: courseInstanceId,
              contactEmail: newContactEmail,
              supervisorName: newSupervisorName,
              supervisorEmail: newSupervisorEmail,
            })
            setEditingSupervisor(false)
          }}
        >
          Save
        </Button>
        <Button variant="secondary" size="medium" onClick={() => setEditingSupervisor(false)}>
          Cancel
        </Button>
      </>
    )
  } else {
    const contactEmail = data.supervisor_email ? (
      <div>Contact email: {data.contact_email}</div>
    ) : (
      <div>No contact email set</div>
    )
    const supervisorName = data.supervisor_name ? (
      <div>Supervisor name: {data.supervisor_name}</div>
    ) : (
      <div>No supervisor name set</div>
    )
    const supervisorEmail = data.supervisor_name ? (
      <div>Supervisor email: {data.supervisor_email}</div>
    ) : (
      <div>No supervisor email set</div>
    )
    supervisorInfo = (
      <>
        {contactEmail}
        {supervisorName}
        {supervisorEmail}
        <Button
          variant="tertiary"
          size="medium"
          onClick={() => {
            setNewSupervisorEmail(data.supervisor_email)
            setNewSupervisorName(data.supervisor_name)
            setEditingSupervisor(true)
          }}
        >
          Edit contact details
        </Button>
        <div>
          Support emails are sent to the contact email if it is set, and to the supervisor email
          otherwise
        </div>
      </>
    )
  }

  let scheduleInfo
  if (editingSchedule) {
    scheduleInfo = (
      <>
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
          onClick={() => {
            scheduleMutation.mutate({
              instanceId: courseInstanceId,
              newClosingTime,
              newOpeningTime,
            })
            setEditingSchedule(false)
          }}
        >
          Save
        </Button>
        <Button variant="secondary" size="medium" onClick={() => setEditingSchedule(false)}>
          Cancel
        </Button>
      </>
    )
  } else {
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
    scheduleInfo = (
      <>
        {schedule}
        <Button
          variant="tertiary"
          size="medium"
          onClick={() => {
            setNewOpeningTime(data.starts_at)
            setNewClosingTime(data.ends_at)
            setEditingSchedule(true)
          }}
        >
          Change schedule
        </Button>
      </>
    )
  }

  return (
    <Layout frontPageUrl={basePath()} navVariant="complex">
      <h1>
        Course instance {data.name ?? "default"} ({data.id})
      </h1>
      {errorMessage && <div>{errorMessage}</div>}
      {supervisorInfo}
      <hr />
      {scheduleInfo}
      <hr />
      <Button
        variant="secondary"
        size="medium"
        onClick={() => deleteMutation.mutate(data.course_id)}
      >
        Delete course instance
      </Button>
    </Layout>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(ManageCourseInstances)),
)
