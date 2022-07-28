import dynamic from "next/dynamic"
import React, { useState } from "react"

import Layout from "../../../components/Layout"
import CourseContext from "../../../contexts/CourseContext"
import { fetchCourseInstance } from "../../../services/backend/course-instances"
import {
  fetchEmailTemplateWithId,
  updateExistingEmailTemplate,
} from "../../../services/backend/email-templates"
import { EmailTemplate, EmailTemplateUpdate } from "../../../shared-module/bindings"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import Spinner from "../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../shared-module/contexts/LoginStateContext"
import useStateQuery from "../../../shared-module/hooks/useStateQuery"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

const EditorLoading = <Spinner variant="medium" />

const EmailEditor = dynamic(() => import("../../../components/editors/EmailEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

export interface EmailTemplateEditProps {
  query: SimplifiedUrlQuery<"id">
}

const EmailTemplateEdit: React.FC<React.PropsWithChildren<EmailTemplateEditProps>> = ({
  query,
}) => {
  const [needToRunMigrationsAndValidations, setNeedToRunMigrationsAndValidations] = useState(false)
  const emailTemplateId = query.id
  // eslint-disable-next-line i18next/no-literal-string
  const templateQuery = useStateQuery(["email-template", emailTemplateId], (_emailTemplateId) =>
    fetchEmailTemplateWithId(_emailTemplateId),
  )
  const instanceQuery = useStateQuery(
    // eslint-disable-next-line i18next/no-literal-string
    ["course-id-of-instance", templateQuery.data?.course_instance_id],
    (courseInstanceId) => fetchCourseInstance(courseInstanceId),
    { onSuccess: () => setNeedToRunMigrationsAndValidations(true) },
  )

  if (templateQuery.state === "error" || instanceQuery.state === "error") {
    return (
      <>
        <ErrorBanner variant={"readOnly"} error={templateQuery.error} />
        <ErrorBanner variant={"readOnly"} error={instanceQuery.error} />
      </>
    )
  }

  if (templateQuery.state !== "ready") {
    return <Spinner variant={"medium"} />
  }

  if (instanceQuery.state !== "ready") {
    return <Spinner variant={"medium"} />
  }

  const handleSave = async (template: EmailTemplateUpdate): Promise<EmailTemplate> => {
    const res = await updateExistingEmailTemplate(emailTemplateId, {
      ...template,
    })
    await templateQuery.refetch()
    return res
  }

  return (
    <CourseContext.Provider value={{ courseId: instanceQuery.data.course_id }}>
      <Layout>
        <EmailEditor
          data={templateQuery.data}
          handleSave={handleSave}
          needToRunMigrationsAndValidations={needToRunMigrationsAndValidations}
          setNeedToRunMigrationsAndValidations={setNeedToRunMigrationsAndValidations}
        />
      </Layout>
    </CourseContext.Provider>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(EmailTemplateEdit)),
)
