"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useEffect } from "react"
import { Trans, useTranslation } from "react-i18next"

import { fetchCompletionRegistrationLink } from "@/services/backend/course-modules"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const CompletionRedirectPage: React.FC = () => {
  const { courseModuleId } = useParams<{ courseModuleId: string }>()
  const { t } = useTranslation()
  const userCompletionInformation = useQuery({
    queryKey: [`course-${courseModuleId}-completion-registration-link`],
    queryFn: () => fetchCompletionRegistrationLink(courseModuleId),
  })

  useEffect(() => {
    if (!userCompletionInformation.data) {
      return
    }
    window.location.replace(userCompletionInformation.data.url)
  }, [userCompletionInformation.data])

  return (
    <>
      {userCompletionInformation.isError && (
        <ErrorBanner
          error={
            // @ts-expect-error: Using property from axios
            userCompletionInformation.error.request.status !== 404
              ? userCompletionInformation.error
              : t("completion-registration-link-not-found")
          }
          variant={"readOnly"}
        />
      )}
      {userCompletionInformation.isLoading && <Spinner variant={"medium"} />}
      {userCompletionInformation.isSuccess && (
        <div>
          <Trans
            t={t}
            i18nKey="you-are-being-redirected-to-completion-registration-page-if-nothing-happens-click-here"
          >
            You are automatically being redirected to Open University&apos;s completion registration
            page. If nothing happens, please{" "}
            <a
              href={userCompletionInformation.data.url}
              onClick={(event) => {
                event.preventDefault()
                window.location.replace(userCompletionInformation.data.url)
              }}
            >
              click here
            </a>
            .
          </Trans>
        </div>
      )}
    </>
  )
}

export default withErrorBoundary(CompletionRedirectPage)
