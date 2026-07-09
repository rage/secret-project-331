"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import RegisterCompletion from "./RegisterCompletion"

import { getCourseModuleUserCompletionOptions } from "@/generated/api/@tanstack/react-query.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"

const REDIRECT = "redirect"

const CompletionPage: React.FC = () => {
  const { t } = useTranslation()
  usePageTitle(t("register-completion"))
  const { courseModuleId } = useParams<{ courseModuleId: string }>()
  const [pathname, setPathname] = useState<string>("")

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPathname(window.location.pathname)
    }
  }, [])

  const userCompletionInformation = useQuery({
    ...getCourseModuleUserCompletionOptions({
      path: {
        course_module_id: courseModuleId,
      },
    }),
  })

  return (
    <QueryResult query={userCompletionInformation}>
      {(data) => {
        if (!data.enable_registering_completion_to_uh_open_university) {
          return (
            <ErrorBanner
              error={t(
                "error-registering-to-the-uh-open-university-not-enabled-for-this-course-module",
              )}
              variant={"readOnly"}
            />
          )
        }
        return <RegisterCompletion data={data} registrationFormUrl={`${pathname}/${REDIRECT}`} />
      }}
    </QueryResult>
  )
}

export default withErrorBoundary(withSignedIn(CompletionPage))
