import { css } from "@emotion/css"
import { Button, Dialog } from "@material-ui/core"
import Link from "next/link"
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
  const {
    isLoading,
    error,
    data: courseInstanceEmailTemplates,
    refetch,
  } = useQuery(`course-instance-${courseInstanceId}-emails`, () =>
    fetchCourseInstanceEmailTemplates(courseInstanceId),
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

  if (isLoading || !courseInstanceEmailTemplates) {
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
        {/* TODO: Perhaps insert some data regarding the course instance */}
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
          {courseInstanceEmailTemplates.map((template) => {
            return (
              <li key={template.id}>
                {template.name}{" "}
                <Link
                  href={{
                    pathname: "/email-templates/[id]/edit",
                    query: { id: template.id },
                  }}
                >
                  Edit
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </Layout>
  )
}
export default withSignedIn(CourseInstanceEmailTemplates)
