"use client"

import React, { useEffect, useState } from "react"

import CourseContext from "../../../contexts/CourseContext"
import {
  fetchEmailTemplateWithId,
  updateExistingEmailTemplate,
} from "../../../services/backend/email-templates"

import { EmailTemplateUpdate } from "@/shared-module/common/bindings"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useStateQuery from "@/shared-module/common/hooks/useStateQuery"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady.pages"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const EmailEditor = dynamicImport(() => import("../../../components/editors/EmailEditor"))

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

  useEffect(() => {
    if (templateQuery.state === "ready" && templateQuery.data) {
      setNeedToRunMigrationsAndValidations(true)
    }
  }, [templateQuery.state, templateQuery.data])

  const saveMutation = useToastMutation(
    (template: EmailTemplateUpdate) => updateExistingEmailTemplate(emailTemplateId, template),
    {
      notify: true,
      method: "PUT",
    },
    {
      onSuccess: () => {
        templateQuery.refetch()
      },
    },
  )

  if (templateQuery.state === "error") {
    return <ErrorBanner variant={"readOnly"} error={templateQuery.error} />
  }

  if (templateQuery.state !== "ready") {
    return <Spinner variant={"medium"} />
  }

  const courseId = templateQuery.data?.course_id

  return (
    <CourseContext.Provider value={courseId ? { courseId } : null}>
      <EmailEditor
        data={templateQuery.data}
        saveMutation={saveMutation}
        needToRunMigrationsAndValidations={needToRunMigrationsAndValidations}
        setNeedToRunMigrationsAndValidations={setNeedToRunMigrationsAndValidations}
      />
      <DebugModal data={templateQuery.data} />
    </CourseContext.Provider>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(EmailTemplateEdit)),
)
