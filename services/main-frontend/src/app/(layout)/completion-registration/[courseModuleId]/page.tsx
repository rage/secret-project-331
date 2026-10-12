"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft } from "@vectopus/atlas-icons-react"
import { useParams } from "next/navigation"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { QUIET_REFRESH, TONE } from "@/components/credit-registration/constants"
import CreditRegistrationStatus from "@/components/credit-registration/CreditRegistrationStatus"
import { courseModuleSubject } from "@/components/credit-registration/creditRegistrationSubject"
import { narrowPageCss } from "@/components/credit-registration/styles"
import { getCourseModuleUserCompletionOptions } from "@/generated/api/@tanstack/react-query.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { profileStudiesRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Infobox, Link, QueryResult } from "@/shared-module/components"

import RegisterCompletion from "./RegisterCompletion"

const REDIRECT = "redirect"

const BACK_ARROW_SIZE = 16

const backLinkCss = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
`

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

  // Quiet refresh: saving an answer refetches this, and blanking the card under the student's
  // hands would throw away where they had got to.
  return (
    <QueryResult query={userCompletionInformation} refreshIndicator={QUIET_REFRESH}>
      {(data) => {
        // Both flags: the module's is permission to use the push path, the completion's own is
        // whether this student's completion was put on it. Without both, this shows the old page.
        if (data.enable_credit_registration_via_suotar && data.register_credits_via_suotar) {
          return (
            <div className={narrowPageCss}>
              <div>
                <Link href={profileStudiesRoute()} className={backLinkCss}>
                  <ArrowLeft size={BACK_ARROW_SIZE} aria-hidden="true" />
                  {t("heading-my-studies")}
                </Link>
              </div>
              <CreditRegistrationStatus
                subject={courseModuleSubject(courseModuleId)}
                courseName={data.course_name}
                moduleName={data.course_module_name}
                ectsCredits={data.ects_credits}
                statusBeforeRegistration={data.status_before_registration}
              />
            </div>
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
            courseModuleId={courseModuleId}
            email={data.email}
            courseName={data.course_name}
            ectsCredits={data.ects_credits}
            registrationFormUrl={`${pathname}/${REDIRECT}`}
            certificateConfigurationId={data.certificate_configuration_id}
            creditJustification={data.credit_justification}
          />
        )
      }}
    </QueryResult>
  )
}

export default withErrorBoundary(withSignedIn(CompletionPage))
