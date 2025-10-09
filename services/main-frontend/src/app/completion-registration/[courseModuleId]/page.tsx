"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams, usePathname } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import RegisterCompletion from "@/components/page-specific/register-completion/RegisterCompletion"
import { fetchUserCompletionInformation } from "@/services/backend/course-modules"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const REDIRECT = "redirect"

const CompletionPage: React.FC = () => {
  const { t } = useTranslation()
  const { courseModuleId } = useParams<{ courseModuleId: string }>()
  const pathname = usePathname()
  const userCompletionInformation = useQuery({
    queryKey: [`course-module-${courseModuleId}-completion-information`],
    queryFn: () => fetchUserCompletionInformation(courseModuleId),
  })

  if (
    userCompletionInformation.isSuccess &&
    !userCompletionInformation.data.enable_registering_completion_to_uh_open_university
  ) {
    return (
      <ErrorBanner
        error={t("error-registering-to-the-uh-open-university-not-enabled-for-this-course-module")}
        variant={"readOnly"}
      />
    )
  }
  return (
    <>
      {userCompletionInformation.isError && (
        <ErrorBanner error={userCompletionInformation.error} variant={"readOnly"} />
      )}
      {userCompletionInformation.isLoading && <Spinner variant={"medium"} />}
      {userCompletionInformation.isSuccess && (
        <RegisterCompletion
          data={userCompletionInformation.data}
          registrationFormUrl={`${pathname}/${REDIRECT}`}
        />
      )}
    </>
  )
}

export default withErrorBoundary(withSignedIn(CompletionPage))
