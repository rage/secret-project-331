"use client"

import { useQuery } from "@tanstack/react-query"
import React, { useEffect, useState } from "react"

import CourseContext from "../../../contexts/CourseContext"

import { EmailTemplateUpdate } from "@/generated/api"
import { getCmsEmailTemplateOptions } from "@/generated/api/@tanstack/react-query.generated"
import { updateCmsEmailTemplate } from "@/generated/api/sdk.generated"
import DebugModal from "@/shared-module/common/components/DebugModal"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady.pages"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const EmailEditor = dynamicImport(() => import("../../../components/editors/EmailEditor"))

export interface EmailTemplateEditProps {
  query: SimplifiedUrlQuery<"id">
}

const EmailTemplateEdit: React.FC<React.PropsWithChildren<EmailTemplateEditProps>> = ({
  query,
}) => {
  const [needToRunMigrationsAndValidations, setNeedToRunMigrationsAndValidations] = useState(false)
  const emailTemplateId = query.id
  const templateQuery = useQuery(
    optionalGeneratedQueryOptions({
      value: emailTemplateId,
      isReady: (emailTemplateId): emailTemplateId is string => Boolean(emailTemplateId),
      build: (emailTemplateId) =>
        getCmsEmailTemplateOptions({
          path: {
            email_template_id: emailTemplateId,
          },
        }),
    }),
  )

  useEffect(() => {
    if (templateQuery.isSuccess && templateQuery.data) {
      setNeedToRunMigrationsAndValidations(true)
    }
  }, [templateQuery.isSuccess, templateQuery.data])

  const saveMutation = useToastMutation(
    (template: EmailTemplateUpdate) =>
      updateCmsEmailTemplate({
        path: {
          email_template_id: emailTemplateId,
        },
        body: template,
      }),
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

  if (templateQuery.isError) {
    return <ErrorBanner variant="readOnly" error={templateQuery.error} />
  }

  if (templateQuery.isLoading || !templateQuery.data) {
    return <Spinner variant="medium" />
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
