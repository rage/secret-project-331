"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useEffect } from "react"
import { Trans, useTranslation } from "react-i18next"

import { getCourseModuleCompletionRegistrationLinkOptions } from "@/generated/api/@tanstack/react-query.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import { isAppApiError } from "@/shared-module/common/errors/AppApiError"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"

const CompletionRedirectPage: React.FC = () => {
  const { courseModuleId } = useParams<{ courseModuleId: string }>()
  const { t } = useTranslation()
  usePageTitle(t("title-completion-registration-redirect"))
  const userCompletionInformation = useQuery(
    getCourseModuleCompletionRegistrationLinkOptions({
      path: {
        course_module_id: courseModuleId,
      },
    }),
  )

  useEffect(() => {
    if (!userCompletionInformation.data) {
      return
    }
    window.location.replace(userCompletionInformation.data.url)
  }, [userCompletionInformation.data])

  return (
    <QueryResult
      query={userCompletionInformation}
      renderBlockingError={({ error }) => (
        <ErrorBanner
          error={
            isAppApiError(error) && error.status === 404
              ? t("completion-registration-link-not-found")
              : error
          }
          variant={"readOnly"}
        />
      )}
    >
      {(data) => (
        <div>
          <Trans
            t={t}
            i18nKey="you-are-being-redirected-to-completion-registration-page-if-nothing-happens-click-here"
          >
            You are automatically being redirected to Open University&apos;s completion registration
            page. If nothing happens, please{" "}
            <a
              href={data.url}
              onClick={(event) => {
                event.preventDefault()
                window.location.replace(data.url)
              }}
            >
              click here
            </a>
            .
          </Trans>
        </div>
      )}
    </QueryResult>
  )
}

export default withErrorBoundary(CompletionRedirectPage)
