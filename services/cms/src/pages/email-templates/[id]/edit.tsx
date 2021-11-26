import dynamic from "next/dynamic"
import React from "react"
import { useTranslation } from "react-i18next"

import Layout from "../../../components/Layout"
import CourseContext from "../../../contexts/CourseContext"
import { fetchCourseInstance } from "../../../services/backend/course-instances"
import {
  fetchEmailTemplateWithId,
  updateExistingEmailTemplate,
} from "../../../services/backend/email-templates"
import { EmailTemplate, EmailTemplateUpdate } from "../../../shared-module/bindings"
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

const EmailTemplateEdit: React.FC<EmailTemplateEditProps> = ({ query }) => {
  const { t } = useTranslation()
  const emailTemplateId = query.id
  // eslint-disable-next-line i18next/no-literal-string
  const templateQuery = useStateQuery(["email-template", emailTemplateId], (_emailTemplateId) =>
    fetchEmailTemplateWithId(_emailTemplateId),
  )
  const instanceQuery = useStateQuery(
    // eslint-disable-next-line i18next/no-literal-string
    ["course-id-of-instance", templateQuery.data?.course_instance_id],
    (courseInstanceId) => fetchCourseInstance(courseInstanceId),
  )

  if (templateQuery.state === "error" || instanceQuery.state === "error") {
    return (
      <div>
        <h1>{t("error")}</h1>
        <pre>{JSON.stringify(templateQuery.error, undefined, 2)}</pre>
        <pre>{JSON.stringify(instanceQuery.error, undefined, 2)}</pre>
      </div>
    )
  }

  if (templateQuery.state !== "ready") {
    return <div>{t("loading")}</div>
  }

  if (instanceQuery.state !== "ready") {
    return <div>{t("loading")}</div>
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
        <EmailEditor data={templateQuery.data} handleSave={handleSave} />
      </Layout>
    </CourseContext.Provider>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(EmailTemplateEdit)),
)
