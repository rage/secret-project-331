import { css } from "@emotion/css"
import { TextField } from "@material-ui/core"
import { useRouter } from "next/router"
import React, { useState } from "react"
import { useMutation } from "react-query"

import Layout from "../../../../components/Layout"
import { newCourseInstance } from "../../../../services/backend/courses"
import Button from "../../../../shared-module/components/Button"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import { wideWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

interface Props {
  query: SimplifiedUrlQuery<"id">
}

const NewCourseInstance: React.FC<Props> = ({ query }) => {
  const courseId = query.id

  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [teacherInChargeName, setTeacherInChargeName] = useState("")
  const [teacherInChargeEmail, setTeacherInChargeEmail] = useState("")
  const [supportEmail, setSupportEmail] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const mutation = useMutation(
    async () => {
      setErrorMessage(null)
      // interpret empty optional values as null
      await newCourseInstance(courseId, {
        name: name || null,
        description: description || null,
        teacher_in_charge_name: teacherInChargeName,
        teacher_in_charge_email: teacherInChargeEmail,
        support_email: supportEmail || null,
      })
    },
    {
      onSuccess: () => {
        router.push(`/manage/courses/${courseId}`)
      },
      onError: (err, a, b) => {
        console.log(a)
        console.log(b)
        if (err instanceof Error) {
          console.log(err.name)
          console.log(err.message)
          console.log(err.stack)
          setErrorMessage(`Failed to update course instance: ${err.message}`)
        } else {
          setErrorMessage(`Unexpected error while updating course instance: ${JSON.stringify(err)}`)
        }
      },
    },
  )

  return (
    <Layout navVariant="complex">
      <div
        className={css`
          ${wideWidthCenteredComponentStyles}
          margin-bottom: 1rem;
        `}
      >
        <h1>New course instance</h1>
        <label htmlFor={"name"}>
          Instance name (required for non-default course instances, and only one default instance is
          allowed)
        </label>
        <br />
        <TextField
          id={"name"}
          value={name}
          onChange={(ev) => setName(ev.currentTarget.value)}
        ></TextField>
        <br />
        <label htmlFor={"description"}>Instance description</label>
        <br />
        <TextField
          id={"description"}
          value={description}
          onChange={(ev) => setDescription(ev.currentTarget.value)}
        ></TextField>
        <br />
        <label htmlFor={"teacher-name"}>Name of teacher-in-charge (required)</label>
        <br />
        <TextField
          id={"teacher-name"}
          value={teacherInChargeName}
          onChange={(ev) => setTeacherInChargeName(ev.currentTarget.value)}
        ></TextField>
        <br />
        <label htmlFor={"teacher-email"}>Email of teacher-in-charge (required)</label>
        <br />
        <TextField
          id={"teacher-email"}
          value={teacherInChargeEmail}
          onChange={(ev) => setTeacherInChargeEmail(ev.currentTarget.value)}
        ></TextField>
        <br />
        <label htmlFor={"support-email"}>Support email</label>
        <br />
        <TextField
          id={"support-email"}
          value={supportEmail}
          onChange={(ev) => setSupportEmail(ev.currentTarget.value)}
        ></TextField>
        <br />
        {errorMessage && <div>Error: {errorMessage}</div>}
        <Button
          variant={"primary"}
          size={"medium"}
          onClick={() => mutation.mutate()}
          disabled={teacherInChargeName.length === 0 || teacherInChargeEmail.length === 0}
        >
          Submit
        </Button>
      </div>
    </Layout>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(NewCourseInstance)),
)
