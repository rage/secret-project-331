import { css } from "@emotion/css"
import { Button, Dialog } from "@material-ui/core"
import React, { useState } from "react"

import { useQuery } from "react-query"
import NewEmailTemplateForm from "../../../components/forms/NewEmailTemplateForm"
import Layout from "../../../components/Layout"
import { fetchCourseInstanceEmailTemplates } from "../../../services/backend/course-instances"
import { withSignedIn } from "../../../shared-module/contexts/LoginStateContext"
import useQueryParameter from "../../../shared-module/hooks/useQueryParameter"
import { normalWidthCenteredComponentStyles } from "../../../styles/componentStyles"

const CourseInstanceEmailTemplates = () => {
  const courseInstanceId = useQueryParameter("id")
  const { isLoading, error, data, refetch } = useQuery(
    `course-instance-${courseInstanceId}-emails`,
    () => fetchCourseInstanceEmailTemplates(courseInstanceId),
  )
  const [showForm, setShowForm] = useState(false)

  if (error) {
    return (
      <div>
        <h1>Error</h1>
        <pre>{JSON.stringify(error, undefined, 2)}</pre>
      </div>
    )
  }

  if (isLoading || !data) {
    return <div>Loading page...</div>
  }

  const handleCreateEmailTemplate = async () => {
    setShowForm(!showForm)
    await refetch()
  }

  return (
    <Layout>
      <div
        className={css`
          ${normalWidthCenteredComponentStyles}
          margin-bottom: 1rem;
        `}
      >
        <h1>E-mail templates for course instance.</h1>
        <Button onClick={() => setShowForm(!showForm)}>Create new e-mail</Button>

        <Dialog open={showForm} onClose={() => setShowForm(!showForm)}>
          <div
            className={css`
              margin: 1rem;
            `}
          >
            <Button onClick={() => setShowForm(!showForm)}>Close</Button>
            <NewEmailTemplateForm
              courseInstanceId={courseInstanceId}
              onSubmitForm={handleCreateEmailTemplate}
            />
          </div>
        </Dialog>
        <ul>
          {data.map((et) => {
            return <li key={et.id}>{et.name}</li>
          })}
        </ul>
      </div>
    </Layout>
  )
}
export default withSignedIn(CourseInstanceEmailTemplates)
