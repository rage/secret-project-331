"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft } from "@vectopus/atlas-icons-react"
import { useParams } from "next/navigation"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  CREDIT_REGISTRATION_NS,
  QUIET_REFRESH,
  TIME_DATE,
} from "@/components/credit-registration/constants"
import { moocfiCompletionStatusCopy } from "@/components/credit-registration/creditRegistrationCopy"
import CreditRegistrationStatus, {
  CardHeading,
} from "@/components/credit-registration/CreditRegistrationStatus"
import { moocfiSubject } from "@/components/credit-registration/creditRegistrationSubject"
import {
  bandCss,
  bandedCardCss,
  narrowPageCss,
  noteCss,
  sectionsCss,
  subheadingCss,
} from "@/components/credit-registration/styles"
import { getMyMoocfiCreditRegistrationsOptions } from "@/generated/api/@tanstack/react-query.generated"
import type {
  MoocfiCompletionRegistration,
  StudentFacingCreditRegistrationStatus,
} from "@/generated/api/types.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Link, QueryResult, RelativeTime } from "@/shared-module/components"

const BACK_ARROW_SIZE = 16

const backLinkCss = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
`

/** The pipeline takes up a stored completion within minutes, so until then it reads as under way. */
const STATUS_BEFORE_REGISTRATION: StudentFacingCreditRegistrationStatus = "sending"

/** Every fetch reads mooc.fi, so it refetches only on a reload or a new visit. */
const QUERY_OPTIONS = { refetchOnWindowFocus: false, staleTime: Infinity } as const

const MoocfiCompletionRegistrationPage: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const { moocfiCourseId } = useParams<{ moocfiCourseId: string }>()
  const query = useQuery({
    ...getMyMoocfiCreditRegistrationsOptions({ path: { moocfi_course_id: moocfiCourseId } }),
    ...QUERY_OPTIONS,
  })

  const courseName = query.data?.course_name
  usePageTitle(
    courseName
      ? t("page-title-credit-registration-for-course", { course: courseName })
      : t("heading-credit-registration"),
  )

  return (
    <div className={narrowPageCss}>
      <QueryResult query={query} refreshIndicator={QUIET_REFRESH} contentClassName={sectionsCss}>
        {(data) => (
          <>
            {data.moocfi_course_url ? (
              <div>
                <Link href={data.moocfi_course_url} className={backLinkCss}>
                  <ArrowLeft size={BACK_ARROW_SIZE} aria-hidden="true" />
                  {t("credit-registration-back-to-moocfi")}
                </Link>
              </div>
            ) : null}
            <p className={noteCss}>
              {t("credit-registration-signed-in-as", { email: data.signed_in_email })}
            </p>
            {data.is_up_to_date ? null : (
              <p className={noteCss}>{t("credit-registration-moocfi-may-be-stale")}</p>
            )}
            {data.completions.length === 0 ? (
              <StatusCard
                courseName={data.course_name}
                ectsCredits={null}
                heading={t("credit-registration-moocfi-nothing-found-heading")}
                body={t("credit-registration-moocfi-nothing-found")}
              />
            ) : (
              data.completions.map((completion) => (
                <MoocfiCompletion
                  key={completion.moocfi_completion_id}
                  completion={completion}
                  courseName={data.course_name}
                />
              ))
            )}
          </>
        )}
      </QueryResult>
    </div>
  )
}

const MoocfiCompletion: React.FC<{
  completion: MoocfiCompletionRegistration
  courseName: string | null | undefined
}> = ({ completion, courseName }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const name = completion.credit_unit?.name ?? courseName
  const ectsCredits = completion.credit_unit?.ects_credits

  if (completion.status === "registering_on_courses" && completion.external_completion_id) {
    return (
      <CreditRegistrationStatus
        subject={moocfiSubject(completion.external_completion_id)}
        courseName={name ?? ""}
        moduleName={null}
        ectsCredits={ectsCredits}
        statusBeforeRegistration={STATUS_BEFORE_REGISTRATION}
      />
    )
  }
  const copy = moocfiCompletionStatusCopy(t, completion.status)
  return (
    <StatusCard
      courseName={name}
      ectsCredits={ectsCredits}
      heading={copy.heading}
      body={copy.body}
      completionDate={completion.completion_date}
    />
  )
}

/** A completion courses does not register, in the same card the registered ones get. */
const StatusCard: React.FC<{
  courseName: string | null | undefined
  ectsCredits: number | null | undefined
  heading: string
  body: string
  completionDate?: string
}> = ({ courseName, ectsCredits, heading, body, completionDate }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <article className={bandedCardCss}>
      <CardHeading courseName={courseName ?? ""} moduleName={null} ectsCredits={ectsCredits} />
      <section className={bandCss}>
        <h2 className={subheadingCss}>{heading}</h2>
        <p>{body}</p>
        {completionDate ? (
          <p className={noteCss}>
            {t("label-completed")} <RelativeTime at={completionDate} absoluteTime={TIME_DATE} />
          </p>
        ) : null}
      </section>
    </article>
  )
}

export default withErrorBoundary(withSignedIn(MoocfiCompletionRegistrationPage))
