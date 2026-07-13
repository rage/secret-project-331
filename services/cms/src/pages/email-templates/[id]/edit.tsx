"use client"

import { useQuery } from "@tanstack/react-query"
import React, { useEffect, useState } from "react"

import CmsPageTitle from "../../../components/CmsPageTitle"
import CourseContext from "../../../contexts/CourseContext"

import type { EmailTemplateUpdate } from "@/generated/api"
import { getCmsEmailTemplateOptions } from "@/generated/api/@tanstack/react-query.generated"
import { updateCmsEmailTemplate } from "@/generated/api/sdk.generated"
import DebugModal from "@/shared-module/common/components/DebugModal"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import type { SimplifiedUrlQuery } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady.pages"
import dontRenderUntilQueryParametersReady from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady.pages"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import { joinTitleSegments } from "@/shared-module/common/utils/pageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components/components/queryResult/QueryResult"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"
import { useTranslation } from "@/utils/useCmsTranslation"

const EmailEditor = dynamicImport(() => import("../../../components/editors/EmailEditor"))

export interface EmailTemplateEditProps {
  query: SimplifiedUrlQuery<"id">
}

const EmailTemplateEdit: React.FC<React.PropsWithChildren<EmailTemplateEditProps>> = ({
  query,
}) => {
  const { t } = useTranslation()
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

  return (
    <QueryResult query={templateQuery}>
      {(data) => {
        const courseId = data.course_id
        return (
          <CourseContext.Provider value={courseId ? { courseId } : null}>
            <CmsPageTitle title={joinTitleSegments([t("edit-email-template"), data.subject])} />
            <EmailEditor
              data={data}
              saveMutation={saveMutation}
              needToRunMigrationsAndValidations={needToRunMigrationsAndValidations}
              setNeedToRunMigrationsAndValidations={setNeedToRunMigrationsAndValidations}
            />
            <DebugModal data={data} />
          </CourseContext.Provider>
        )
      }}
    </QueryResult>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(EmailTemplateEdit)),
)
