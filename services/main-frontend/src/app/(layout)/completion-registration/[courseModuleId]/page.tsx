"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { TONE } from "@/components/credit-registration/constants"
import { getCourseModuleUserCompletionOptions } from "@/generated/api/@tanstack/react-query.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Infobox, QueryResult } from "@/shared-module/components"

import CreditRegistrationStatus from "./CreditRegistrationStatus"
import RegisterCompletion from "./RegisterCompletion"

const REDIRECT = "redirect"

const CompletionPage: React.FC = () => {
  const { t } = useTranslation()
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

  const courseName = userCompletionInformation.data?.course_name
  usePageTitle(
    courseName
      ? t("page-title-credit-registration-for-course", { course: courseName })
      : t("heading-credit-registration"),
  )

  return (
    <QueryResult query={userCompletionInformation}>
      {(data) => {
        // Both flags: the module's is permission to use the push path, the completion's own is
        // whether this student's completion was put on it. Without both, this shows the old page.
        if (data.enable_credit_registration_via_suotar && data.register_credits_via_suotar) {
          return (
            <CreditRegistrationStatus
              courseModuleId={courseModuleId}
              courseName={data.course_name}
              moduleName={data.course_module_name}
              ectsCredits={data.ects_credits}
            />
          )
        }
        if (!data.enable_registering_completion_to_uh_open_university) {
          return (
            <Infobox tone={TONE.INFO} heading={t("register-completion")}>
              {t("this-course-does-not-register-credits-for-you")}
            </Infobox>
          )
        }
        return (
          <RegisterCompletion
            email={data.email}
            courseName={data.course_name}
            ectsCredits={data.ects_credits}
            registrationFormUrl={`${pathname}/${REDIRECT}`}
          />
        )
      }}
    </QueryResult>
  )
}

export default withErrorBoundary(withSignedIn(CompletionPage))
