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
import {
  moocfiCompletionStatusCopy,
  registrationStatusLabel,
} from "@/components/credit-registration/creditRegistrationCopy"
import CreditRegistrationStatus, {
  CardHeading,
} from "@/components/credit-registration/CreditRegistrationStatus"
import {
  moocfiCertificateOffer,
  moocfiSubject,
} from "@/components/credit-registration/creditRegistrationSubject"
import {
  bandCss,
  bandedCardCss,
  narrowPageCss,
  headingCss,
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
import useQueryParameter from "@/shared-module/common/hooks/useQueryParameter"
import { moocfiCompletionRegistrationRoute } from "@/shared-module/common/utils/routes"
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

/** Picks the one completion whose stepper the page shows, so its `step` param is unambiguous. */
const COMPLETION_PARAM = "completion"

const isRegistering = (completion: MoocfiCompletionRegistration) =>
  completion.status === "registering_on_courses" && Boolean(completion.external_completion_id)

const MoocfiCompletionRegistrationPage: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const { moocfiCourseId } = useParams<{ moocfiCourseId: string }>()
  const requestedCompletionId = useQueryParameter(COMPLETION_PARAM)
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
              <Completions
                completions={data.completions}
                courseName={data.course_name}
                moocfiCourseId={moocfiCourseId}
                requestedCompletionId={requestedCompletionId}
              />
            )}
          </>
        )}
      </QueryResult>
    </div>
  )
}

/**
 * The chosen completion's stepper, or a card per completion to choose from. The usual student has
 * one completion registering, which is chosen for them.
 */
const Completions: React.FC<{
  completions: MoocfiCompletionRegistration[]
  courseName: string | null | undefined
  moocfiCourseId: string
  requestedCompletionId: string
}> = ({ completions, courseName, moocfiCourseId, requestedCompletionId }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const registering = completions.filter((completion) => isRegistering(completion))
  const requested = completions.find(
    (completion) =>
      isRegistering(completion) && completion.external_completion_id === requestedCompletionId,
  )
  const chosen = requested ?? (registering.length === 1 ? registering[0] : undefined)
  const pageRoute = moocfiCompletionRegistrationRoute(moocfiCourseId)

  if (chosen && requested) {
    return (
      <>
        {completions.length > 1 ? (
          <div>
            <Link href={pageRoute} className={backLinkCss}>
              <ArrowLeft size={BACK_ARROW_SIZE} aria-hidden="true" />
              {t("credit-registration-moocfi-all-completions")}
            </Link>
          </div>
        ) : null}
        <MoocfiCompletion completion={chosen} courseName={courseName} />
      </>
    )
  }
  const others = completions.filter((completion) => completion !== chosen)
  const cards = others.map((completion) =>
    isRegistering(completion) ? (
      <RegisteringCard
        key={completion.moocfi_completion_id}
        completion={completion}
        courseName={courseName}
        href={`${pageRoute}?${COMPLETION_PARAM}=${completion.external_completion_id}`}
      />
    ) : (
      <MoocfiCompletion
        key={completion.moocfi_completion_id}
        completion={completion}
        courseName={courseName}
      />
    ),
  )
  if (chosen) {
    return (
      <>
        <MoocfiCompletion completion={chosen} courseName={courseName} />
        {cards.length > 0 ? (
          <>
            <h2 className={headingCss}>{t("credit-registration-moocfi-other-completions")}</h2>
            {cards}
          </>
        ) : null}
      </>
    )
  }
  return (
    <>
      {registering.length > 1 ? <p>{t("credit-registration-moocfi-choose-completion")}</p> : null}
      {cards}
    </>
  )
}

/** A completion registering here, as a link to its own stepper. */
const RegisteringCard: React.FC<{
  completion: MoocfiCompletionRegistration
  courseName: string | null | undefined
  href: string
}> = ({ completion, courseName, href }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <article className={bandedCardCss}>
      <CardHeading
        courseName={completion.credit_unit?.name ?? courseName ?? ""}
        moduleName={null}
        ectsCredits={completion.credit_unit?.ects_credits}
      />
      <section className={bandCss}>
        <h2 className={subheadingCss}>
          {registrationStatusLabel(
            t,
            completion.student_facing_status ?? STATUS_BEFORE_REGISTRATION,
          )}
        </h2>
        <p className={noteCss}>
          {t("label-completed")}{" "}
          <RelativeTime at={completion.completion_date} absoluteTime={TIME_DATE} />
        </p>
        <div>
          <Link href={href}>{t("credit-registration-moocfi-show-registration")}</Link>
        </div>
      </section>
    </article>
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
        certificate={moocfiCertificateOffer(
          completion.external_completion_id,
          completion.offers_certificate,
          completion.credit_justification,
        )}
        uhCourseCode={completion.credit_unit?.uh_course_code}
        enrolmentLink={completion.credit_unit?.enrolment_link}
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
