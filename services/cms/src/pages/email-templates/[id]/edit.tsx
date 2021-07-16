import dynamic from "next/dynamic"
import { useQuery } from "react-query"

import Layout from "../../../components/Layout"
import CourseContext from "../../../contexts/CourseContext"
import { fetchCourseInstance } from "../../../services/backend/course-instances"
import {
  fetchEmailTemplateWithId,
  updateExistingEmailTemplate,
} from "../../../services/backend/email-templates"
import { EmailTemplate, EmailTemplateUpdate } from "../../../services/services.types"
import { withSignedIn } from "../../../shared-module/contexts/LoginStateContext"
import useQueryParameter from "../../../shared-module/hooks/useQueryParameter"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import dontRenderUntilQueryParametersReady from "../../../utils/dontRenderUntilQueryParametersReady"

const EditorLoading = <div>Loading editor...</div>

const EmailEditor = dynamic(() => import("../../../components/editors/EmailEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

const EmailTemplateEdit: React.FC = () => {
  const emailTemplateId = useQueryParameter("id")
  const {
    isLoading: emailTemplateIsLoading,
    error: emailTemplateError,
    data: emailTemplateData,
    refetch,
  } = useQuery(`email-template-${emailTemplateId}`, () => fetchEmailTemplateWithId(emailTemplateId))
  const {
    data: courseInstanceData,
    error: courseInstanceError,
    isLoading: courseInstanceIsLoading,
  } = useQuery(
    ["course-id-of-instance", emailTemplateData?.course_instance_id],
    () => fetchCourseInstance(emailTemplateData.course_instance_id),
    { enabled: !emailTemplateIsLoading && !!emailTemplateData },
  )

  if (emailTemplateError || courseInstanceError) {
    return (
      <div>
        <h1>Error</h1>
        <pre>{JSON.stringify(emailTemplateError, undefined, 2)}</pre>
        <pre>{JSON.stringify(courseInstanceError, undefined, 2)}</pre>
      </div>
    )
  }

  if (emailTemplateIsLoading || !emailTemplateData) {
    return <div>Loading template data...</div>
  }

  if (courseInstanceIsLoading || !courseInstanceData) {
    return <div>Loading editor data...</div>
  }

  const handleSave = async (template: EmailTemplateUpdate): Promise<EmailTemplate> => {
    const res = await updateExistingEmailTemplate(emailTemplateId, {
      ...template,
    })
    await refetch()
    return res
  }

  return (
    <CourseContext.Provider value={{ courseId: courseInstanceData.course_id }}>
      <Layout>
        <EmailEditor data={emailTemplateData} handleSave={handleSave} />
      </Layout>
    </CourseContext.Provider>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(EmailTemplateEdit)),
)
