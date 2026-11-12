"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft } from "@vectopus/atlas-icons-react"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  CREDIT_REGISTRATION_NS,
  QUIET_REFRESH,
  TONE,
} from "@/components/credit-registration/constants"
import CreditRegistrationStatus from "@/components/credit-registration/CreditRegistrationStatus"
import {
  courseModuleSubject,
  moduleCertificateOffer,
} from "@/components/credit-registration/creditRegistrationSubject"
import { narrowPageCss } from "@/components/credit-registration/styles"
import { getCourseModuleUserCompletionOptions } from "@/generated/api/@tanstack/react-query.generated"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { profileStudiesRoute } from "@/shared-module/common/utils/routes"
import { Infobox, Link, QueryResult } from "@/shared-module/components"

import RegisterCompletion from "./RegisterCompletion"

const REDIRECT = "redirect"

const BACK_ARROW_SIZE = 16

const backLinkCss = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
`

const BackToMyStudies: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <div>
      <Link href={profileStudiesRoute()} className={backLinkCss}>
        <ArrowLeft size={BACK_ARROW_SIZE} aria-hidden="true" />
        {t("heading-my-studies")}
      </Link>
    </div>
  )
}

/** The registration page for one of the signed-in student's module completions. */
const CompletionRegistrationPage: React.FC<{ courseModuleId: string }> = ({ courseModuleId }) => {
  const { t } = useTranslation()
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
        if (!data.registers_credits) {
          return (
            <Infobox tone={TONE.INFO} heading={t("register-completion")}>
              {t("this-course-does-not-register-credits-for-you")}
            </Infobox>
          )
        }
        const certificate = moduleCertificateOffer(
          courseModuleId,
          data.certificate_configuration_id,
          data.credit_justification,
        )
        if (data.register_credits_via_suotar) {
          return (
            <div className={narrowPageCss}>
              <BackToMyStudies />
              <CreditRegistrationStatus
                subject={courseModuleSubject(courseModuleId)}
                courseName={data.course_name}
                moduleName={data.course_module_name}
                ectsCredits={data.ects_credits}
                statusBeforeRegistration={data.status_before_registration}
                certificate={certificate}
                uhCourseCode={data.uh_course_code}
                enrolmentLink={data.enrolment_link}
              />
            </div>
          )
        }
        // A completion from before the push path keeps the old page.
        return (
          <RegisterCompletion
            email={data.email}
            courseName={data.course_name}
            ectsCredits={data.ects_credits}
            registrationFormUrl={`${pathname}/${REDIRECT}`}
            certificate={certificate}
          />
        )
      }}
    </QueryResult>
  )
}

export default CompletionRegistrationPage
