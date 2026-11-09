"use client"

import { announce } from "@react-aria/live-announcer"
import React, { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import type {
  MyCreditRegistration,
  MyEnrolmentRoute,
  MyVerifiedStudentNumber,
  StudentFacingCreditRegistrationStatus,
} from "@/generated/api/types.generated"
import { dateToString } from "@/shared-module/common/utils/time"
import { Button, Infobox } from "@/shared-module/components"

import {
  BUTTON_TERTIARY,
  CREDIT_REGISTRATION_NS,
  OPEN_UNIVERSITY,
  TONE,
  UNIVERSITY_OF_HELSINKI,
} from "../constants"
import { enrolmentConfirmedSentence, myRegistrationStatusLabel } from "../creditRegistrationCopy"
import { useRecordEnrolmentPageVisitOnce } from "../enrolmentActions"
import { EnrolmentCheck } from "../EnrolmentCheck"
import { missingSisuCourseCodeSupportMail } from "../studentSupportMail"
import { bandedCardCss } from "../styles"
import { studentNumberLinkBand, wasListedByTheRegistry } from "../trackerView"
import { useIsAccountLinkingEnabled } from "../useIsAccountLinkingEnabled"
import { CertificateChosenPage } from "./CertificateChosenPage"
import { EnrolmentPage } from "./EnrolmentPage"
import { LinkingPage } from "./LinkingPage"
import { OverviewPage } from "./OverviewPage"
import { QuestionsPage } from "./QuestionsPage"
import { RecheckLever, StatusPage } from "./StatusPage"
import { StepIndicator } from "./StepIndicator"
import { StepperFaq } from "./StepperFaq"
import { captionCss, pageCss } from "./stepperStyles"
import {
  canWithdrawEnrolmentConfirmation,
  detourRoute,
  isReachable,
  landingPage,
  PAGE,
  type StatusPage as StatusPageKind,
  type StepperInput,
  type StepperPage,
  statusPageOf,
  stepOf,
  stepsFor,
} from "./stepperView"
import { storedAnswersOf, useEnrolmentAnswers } from "./useEnrolmentAnswers"
import { useStepParam } from "./useStepParam"

/** The pages on which the student is enrolling or waiting for the enrolment to be seen. */
const ENROLLING_PAGES: readonly (StepperPage | StatusPageKind)[] = [
  "questions",
  "enrolment",
  "linking",
  "waiting",
]

export interface RegistrationStepperProps {
  courseModuleId: string
  heading: React.ReactNode
  courseName: string
  moduleName: string | null | undefined
  ectsCredits: number | null | undefined
  /** `null` before the pipeline has created a ledger row for the completion. */
  registration: MyCreditRegistration | null
  statusBeforeRegistration: StudentFacingCreditRegistrationStatus
  enrolmentRoute: MyEnrolmentRoute | null
  verifiedNumber: MyVerifiedStudentNumber | null
  certificateConfigurationId: string | null | undefined
  creditJustification: string | null | undefined
  /** The Sisu course to enrol on, known before the registration exists. */
  uhCourseCode: string | null | undefined
  /** Where an Open University student enrols, known before the registration exists. */
  enrolmentLink: string | null | undefined
  checkedAt: string | null
  /** Rendered between the card and the questions: the earlier attempts. */
  children?: React.ReactNode
}

/**
 * The registration as steps: questions, enrolment and, without a linked number, linking. Once the
 * registration is past what the student drives, a status page without the steps.
 *
 * Lands on where the student left off; the step in the address lets them look back, as far as the
 * registration still allows.
 */
export const RegistrationStepper: React.FC<RegistrationStepperProps> = ({
  courseModuleId,
  heading,
  courseName,
  moduleName,
  ectsCredits,
  registration,
  statusBeforeRegistration,
  enrolmentRoute,
  verifiedNumber,
  certificateConfigurationId,
  creditJustification,
  uhCourseCode,
  enrolmentLink,
  checkedAt,
  children,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const isAccountLinkingEnabled = useIsAccountLinkingEnabled()
  const [hasSavedJustificationHere, setHasSavedJustificationHere] = useState(false)
  const actions = useEnrolmentAnswers(courseModuleId, registration?.course_id ?? null)
  const { requestedPage, goTo } = useStepParam()

  const hasLinkedStudentNumber = verifiedNumber !== null
  const input: StepperInput = {
    registration,
    statusBeforeRegistration,
    enrolmentRoute,
    hasLinkedStudentNumber,
    hasCertificate: Boolean(certificateConfigurationId),
    hasSavedJustification: Boolean(creditJustification) || hasSavedJustificationHere,
  }
  const statusPage = statusPageOf(input)
  const page: StepperPage | StatusPageKind =
    statusPage ??
    (requestedPage && isReachable(requestedPage, input) ? requestedPage : landingPage(input))
  const route = detourRoute(enrolmentRoute, input.hasCertificate, input.hasSavedJustification)
  const isSisu = enrolmentRoute?.route === UNIVERSITY_OF_HELSINKI
  const studentNumber = verifiedNumber?.student_number ?? registration?.student_number ?? null
  const courseCode = (registration?.uh_course_code ?? uhCourseCode)?.trim() || null
  const supportCourse = { courseName, moduleName }

  useRecordEnrolmentPageVisitOnce(courseModuleId, ENROLLING_PAGES.includes(page))

  // A page change moves focus to its heading, so a screen reader reads where the student now is.
  const pageRef = useRef<HTMLElement>(null)
  const shownPage = useRef(page)
  useEffect(() => {
    if (shownPage.current === page) {
      return
    }
    shownPage.current = page
    pageRef.current?.querySelector<HTMLElement>("h2")?.focus()
  }, [page])

  // The page polls, so a status that moves while it is open has to be announced, not only redrawn.
  const statusLabel = registration ? myRegistrationStatusLabel(t, registration) : null
  const announcedStatusLabel = useRef(statusLabel)
  useEffect(() => {
    if (statusLabel !== null && announcedStatusLabel.current !== statusLabel) {
      announcedStatusLabel.current = statusLabel
      announce(t("credit-registration-status-is-now", { status: statusLabel }))
    }
  }, [statusLabel, t])

  const navigate = (next: StepperPage) => {
    goTo(next)
    window.scrollTo(0, 0)
  }

  const confirmEnrolment = async () => {
    await actions.confirmEnrolment.mutateAsync()
    if (!hasLinkedStudentNumber) {
      navigate(PAGE.linking)
    }
  }

  const withdrawEnrolmentConfirmation = async () => {
    await actions.withdrawEnrolmentConfirmation.mutateAsync()
    navigate(PAGE.enrolment)
  }

  const changeCertificateChoice = async () => {
    await actions.withdrawCertificateChoice.mutateAsync()
    const answers = enrolmentRoute ? storedAnswersOf(enrolmentRoute) : null
    if (answers) {
      actions.saveAnswers.mutate({ ...answers, need: null, need_after_reconsider: null })
    }
    navigate(PAGE.questions)
  }

  const confirmedAt = enrolmentRoute?.enrolment_confirmed_at
  const confirmedSentence = confirmedAt ? (
    <p className={captionCss}>
      {enrolmentConfirmedSentence(t, enrolmentRoute?.route, dateToString(confirmedAt))}
    </p>
  ) : null
  const acceptanceTakesDays =
    enrolmentRoute?.route === OPEN_UNIVERSITY && !wasListedByTheRegistry(registration) ? (
      <p className={captionCss}>{t("credit-registration-open-university-acceptance-takes-days")}</p>
    ) : null

  const wayBack = canWithdrawEnrolmentConfirmation(input) ? (
    <p className={captionCss}>
      {t("credit-registration-not-enrolled-after-all")}{" "}
      <Button
        variant={BUTTON_TERTIARY}
        size="small"
        isLoading={actions.withdrawEnrolmentConfirmation.isPending}
        onClick={() => void withdrawEnrolmentConfirmation()}
      >
        {t("credit-registration-go-back-to-enrolment")}
      </Button>
    </p>
  ) : null

  const enrolmentCheck = (
    <EnrolmentCheck
      registration={registration}
      enrolmentRoute={enrolmentRoute}
      hasLinkedStudentNumber={hasLinkedStudentNumber}
      course={supportCourse}
      courseCode={courseCode}
    />
  )

  const content = (() => {
    switch (page) {
      case "overview":
        return (
          <OverviewPage
            studentNumber={hasLinkedStudentNumber ? studentNumber : null}
            onStart={() => navigate(PAGE.questions)}
          />
        )
      case "questions":
        return enrolmentRoute ? (
          <QuestionsPage
            courseModuleId={courseModuleId}
            enrolmentRoute={enrolmentRoute}
            certificateConfigurationId={certificateConfigurationId}
            creditJustification={creditJustification}
            hasSavedJustification={input.hasSavedJustification}
            onJustificationSaved={() => setHasSavedJustificationHere(true)}
            actions={actions}
            onContinue={() => navigate(PAGE.enrolment)}
          />
        ) : null
      case "enrolment":
        return (
          <EnrolmentPage
            isSisu={route === "sisu"}
            courseCode={courseCode}
            openUniversityEnrolmentLink={registration?.enrolment_link ?? enrolmentLink}
            missingCourseCodeSupportMail={missingSisuCourseCodeSupportMail(
              t,
              registration,
              supportCourse,
            )}
            isConfirming={actions.confirmEnrolment.isPending}
            onConfirm={() => void confirmEnrolment()}
            onChangeAnswers={() => navigate(PAGE.questions)}
          />
        )
      case "linking":
        return (
          <LinkingPage
            band={
              registration
                ? studentNumberLinkBand(registration, verifiedNumber, {
                    isAccountLinkingEnabled,
                    enrolmentRoute,
                  })
                : null
            }
            isSisu={isSisu}
            courseName={courseName}
            courseCode={courseCode}
          >
            {confirmedSentence}
            {acceptanceTakesDays}
            {enrolmentCheck}
            {registration ? <RecheckLever registration={registration} /> : null}
            {wayBack}
          </LinkingPage>
        )
      case "certificate":
        return (
          <CertificateChosenPage
            courseModuleId={courseModuleId}
            certificateConfigurationId={certificateConfigurationId}
            isWithdrawing={actions.withdrawCertificateChoice.isPending}
            onChangeChoice={() => void changeCertificateChoice()}
          />
        )
      default:
        return (
          <StatusPage
            kind={page}
            registration={registration}
            statusBeforeRegistration={statusBeforeRegistration}
            studentNumber={studentNumber}
            isDegreeStudent={isSisu}
            moduleEctsCredits={ectsCredits}
            checkedAt={checkedAt}
          >
            {page === "waiting" ? (
              <>
                {confirmedSentence}
                {acceptanceTakesDays}
                {enrolmentCheck}
                {wayBack}
              </>
            ) : null}
          </StatusPage>
        )
    }
  })()

  const step = statusPage === null ? stepOf(page as StepperPage) : null

  return (
    <>
      <article className={bandedCardCss}>
        {heading}
        {step ? (
          <StepIndicator
            steps={stepsFor(hasLinkedStudentNumber)}
            current={step}
            onGoTo={wasListedByTheRegistry(registration) ? null : (target) => navigate(target)}
          />
        ) : null}
        <section ref={pageRef} className={pageCss}>
          {actions.isError ? (
            <Infobox tone={TONE.DANGER}>
              {t("credit-registration-enrolment-answer-save-failed")}
            </Infobox>
          ) : null}
          {content}
        </section>
      </article>
      {children}
      <StepperFaq page={page} isSisu={isSisu} courseName={courseName} />
    </>
  )
}
