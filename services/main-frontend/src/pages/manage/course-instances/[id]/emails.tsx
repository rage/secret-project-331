import { css } from "@emotion/css"
import { Dialog } from "@material-ui/core"
import React, { useState } from "react"
import { useQuery } from "react-query"

import Layout from "../../../../components/Layout"
import NewEmailTemplateForm from "../../../../components/forms/NewEmailTemplateForm"
import {
  fetchCourseInstanceEmailTemplates,
  postNewEmailTemplateForCourseInstance,
} from "../../../../services/backend/course-instances"
import { deleteEmailTemplate } from "../../../../services/backend/email-templates"
import Button from "../../../../shared-module/components/Button"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import basePath from "../../../../shared-module/utils/base-path"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

export interface CourseInstanceEmailTemplatesProps {
  query: SimplifiedUrlQuery<"id">
}

const CourseInstanceEmailTemplates: React.FC<CourseInstanceEmailTemplatesProps> = ({ query }) => {
  const courseInstanceId = query.id
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

  const handleCreateEmailTemplate = async (newName: string) => {
    const result = await postNewEmailTemplateForCourseInstance(courseInstanceId, {
      name: newName,
    })
    setShowForm(!showForm)
    window.location.assign(`/cms/email-templates/${result.id}/edit`)
  }

  const handleOnDelete = async (templateId: string) => {
    await deleteEmailTemplate(templateId)
    await refetch()
  }

  return (
    <Layout navVariant="complex">
      <div
        className={css`
          ${normalWidthCenteredComponentStyles}
          margin-bottom: 1rem;
        `}
      >
        {/* TODO: Perhaps insert some data regarding the course instance */}
        <h1>E-mail templates for course instance.</h1>
        <Button size="medium" variant="primary" onClick={() => setShowForm(!showForm)}>
          Create new e-mail
        </Button>

        <Dialog open={showForm} onClose={() => setShowForm(!showForm)}>
          <div
            className={css`
              margin: 1rem;
            `}
          >
            <Button size="medium" variant="primary" onClick={() => setShowForm(!showForm)}>
              Close
            </Button>
            <NewEmailTemplateForm onSubmitForm={handleCreateEmailTemplate} />
          </div>
        </Dialog>
        <ul>
          {courseInstanceEmailTemplates.map((template) => {
            return (
              <li key={template.id}>
                {template.name} <a href={`/cms/email-templates/${template.id}/edit`}>Edit</a>{" "}
                <Button
                  size="medium"
                  variant="secondary"
                  onClick={async () => await handleOnDelete(template.id)}
                >
                  Delete
                </Button>
              </li>
            )
          })}
        </ul>
      </div>
    </Layout>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(CourseInstanceEmailTemplates)),
)
