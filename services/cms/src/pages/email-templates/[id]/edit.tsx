import Layout from "../../../components/Layout"
import { useQuery } from "react-query"

import { withSignedIn } from "../../../shared-module/contexts/LoginStateContext"
import dynamic from "next/dynamic"
import useQueryParameter from "../../../shared-module/hooks/useQueryParameter"
import {
  fetchEmailTemplateWithId,
  updateExistingEmailTemplate,
} from "../../../services/backend/email-templates"
import { EmailTemplate, EmailTemplateUpdate } from "../../../services/services.types"
import dontRenderUntilQueryParametersReady from "../../../utils/dontRenderUntilQueryParametersReady"

const EditorLoading = <div>Loading editor...</div>

const EmailEditor = dynamic(() => import("../../../components/editors/EmailEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

const EmailTemplateEdit = () => {
  const emailTemplateId = useQueryParameter("id")
  const { isLoading, error, data, refetch } = useQuery(`email-template-${emailTemplateId}`, () =>
    fetchEmailTemplateWithId(emailTemplateId),
  )

  if (error) {
    return (
      <div>
        <h1>Error</h1>
        <pre>{JSON.stringify(error, undefined, 2)}</pre>
      </div>
    )
  }

  if (isLoading || !data) {
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
    <Layout>
      <EmailEditor data={data} handleSave={handleSave} />
    </Layout>
  )
}

export default withSignedIn(dontRenderUntilQueryParametersReady(EmailTemplateEdit))
