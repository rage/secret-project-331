"use client"

import { css } from "@emotion/css"
import { useRouter } from "next/navigation"
import React, { useEffect, useMemo } from "react"
import { VisuallyHidden } from "react-aria"
import { useForm } from "react-hook-form"
import { Trans, useTranslation } from "react-i18next"

import type {
  CreditRegistrationEnrolmentRoute,
  CreditRegistrationIdentification,
  CreditRegistrationNeed,
  MyEnrolmentRoute,
} from "@/generated/api/types.generated"
import { Button, Link, Radio, RadioGroup, TransLink, useDialog } from "@/shared-module/components"

import { certificateHref } from "../certificateHref"
import {
  BUTTON_PRIMARY,
  CREDIT_REGISTRATION_NS,
  OPEN_UNIVERSITY,
  SEGMENTED,
  SUOMI_FI_EIDAS_URL,
  SUOMI_FI_IDENTIFICATION_URL,
  SUPPORT_EMAIL,
  UNIVERSITY_OF_HELSINKI,
} from "../constants"
import { CreditJustificationForm } from "../CreditJustificationForm"
import { useIsDemoMode } from "../demoMode"
import {
  decisionCss,
  decisionTextCss,
  fullWidthCss,
  HIDDEN_HEADING,
  noteBoxCss,
  noteTitleCss,
  pageCss,
} from "./stepperStyles"
import type { DetourRoute } from "./stepperView"
import { detourRoute } from "./stepperView"
import type { EnrolmentAnswerActions, EnrolmentAnswers } from "./useEnrolmentAnswers"

const ROUTE_FIELD = "route"
const HAS_FINNISH_ID_FIELD = "hasFinnishId"
const NEED_FIELD = "need"
const IDENTIFICATION_FIELD = "identification"
const NEED_AFTER_RECONSIDER_FIELD = "needAfterReconsider"

const YES = "yes"
const NO = "no"
const CERTIFICATE: CreditRegistrationNeed = "certificate"
const CREDITS: CreditRegistrationNeed = "credits"
const EIDAS: CreditRegistrationIdentification = "eidas"
const OTHER_SUOMI_FI: CreditRegistrationIdentification = "other_suomi_fi"
const NO_SUOMI_FI: CreditRegistrationIdentification = "none"

interface QuestionsForm {
  [ROUTE_FIELD]: string
  [HAS_FINNISH_ID_FIELD]: string
  [NEED_FIELD]: string
  [IDENTIFICATION_FIELD]: string
  [NEED_AFTER_RECONSIDER_FIELD]: string
}

const answerHintCss = css`
  display: block;
  font-style: italic;
`

const formValuesOf = (enrolmentRoute: MyEnrolmentRoute): QuestionsForm => ({
  [ROUTE_FIELD]: enrolmentRoute.route ?? "",
  [HAS_FINNISH_ID_FIELD]:
    enrolmentRoute.has_finnish_personal_identity_code === true
      ? YES
      : enrolmentRoute.has_finnish_personal_identity_code === false
        ? NO
        : "",
  [NEED_FIELD]: enrolmentRoute.need ?? "",
  [IDENTIFICATION_FIELD]: enrolmentRoute.identification ?? "",
  [NEED_AFTER_RECONSIDER_FIELD]: enrolmentRoute.need_after_reconsider ?? "",
})

const orNull = <T extends string>(value: string | undefined): T | null =>
  value ? (value as T) : null

const answersOf = (values: Partial<QuestionsForm>): EnrolmentAnswers | null => {
  const route = values[ROUTE_FIELD]
  if (!route) {
    return null
  }
  const hasFinnishId = values[HAS_FINNISH_ID_FIELD]
  return {
    route: route as CreditRegistrationEnrolmentRoute,
    has_finnish_personal_identity_code:
      hasFinnishId === YES ? true : hasFinnishId === NO ? false : null,
    need: orNull<CreditRegistrationNeed>(values[NEED_FIELD]),
    identification: orNull<CreditRegistrationIdentification>(values[IDENTIFICATION_FIELD]),
    need_after_reconsider: orNull<CreditRegistrationNeed>(values[NEED_AFTER_RECONSIDER_FIELD]),
  }
}

export interface QuestionsPageProps {
  courseModuleId: string
  enrolmentRoute: MyEnrolmentRoute
  /** Set when a certificate could serve instead, which asks the detour questions. */
  certificateConfigurationId: string | null | undefined
  creditJustification: string | null | undefined
  hasSavedJustification: boolean
  onJustificationSaved: () => void
  actions: EnrolmentAnswerActions
  onContinue: () => void
}

/**
 * Which way the student registers: as a University of Helsinki student in Sisu, through the Open
 * University, or not at all because a certificate serves them.
 *
 * Every answer is saved as it is given. Each question opens only under the answer that leads to
 * it, and a changed answer only hides what is under it, so flipping back finds the old answers.
 */
export const QuestionsPage: React.FC<QuestionsPageProps> = ({
  courseModuleId,
  enrolmentRoute,
  certificateConfigurationId,
  creditJustification,
  hasSavedJustification,
  onJustificationSaved,
  actions,
  onContinue,
}) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const router = useRouter()
  const isDemoMode = useIsDemoMode()
  const { alert } = useDialog()
  const stored = useMemo(() => formValuesOf(enrolmentRoute), [enrolmentRoute])
  const { control, watch, reset } = useForm<QuestionsForm>({ defaultValues: stored })

  useEffect(() => {
    reset(stored)
  }, [reset, stored])

  const { mutate: saveAnswers } = actions.saveAnswers
  const { mutate: withdrawCertificateChoice } = actions.withdrawCertificateChoice
  const hasCertificate = Boolean(certificateConfigurationId)
  const isCertificateChosen = Boolean(enrolmentRoute.certificate_chosen_at)
  useEffect(() => {
    const subscription = watch((values, { type }) => {
      if (type !== "change") {
        return
      }
      const answers = answersOf(values)
      if (!answers) {
        return
      }
      saveAnswers(answers)
      // The server keeps the choice until it is withdrawn, and it decides where the student lands.
      if (
        isCertificateChosen &&
        detourRoute({ ...enrolmentRoute, ...answers }, hasCertificate, hasSavedJustification) !==
          "certificate"
      ) {
        withdrawCertificateChoice()
      }
    })
    return () => subscription.unsubscribe()
  }, [
    watch,
    saveAnswers,
    withdrawCertificateChoice,
    isCertificateChosen,
    enrolmentRoute,
    hasCertificate,
    hasSavedJustification,
  ])

  const values = watch()
  const route: DetourRoute | null = detourRoute(
    { ...enrolmentRoute, ...answersOf(values) },
    hasCertificate,
    hasSavedJustification,
  )
  const asksFinnishId = values[ROUTE_FIELD] === OPEN_UNIVERSITY && hasCertificate
  const asksNeed = asksFinnishId && values[HAS_FINNISH_ID_FIELD] === NO
  const asksIdentification = asksNeed && values[NEED_FIELD] === CREDITS
  const asksToReconsider = asksIdentification && values[IDENTIFICATION_FIELD] === NO_SUOMI_FI
  const asksWhyCreditsAreNeeded =
    asksToReconsider && values[NEED_AFTER_RECONSIDER_FIELD] === CREDITS

  const goToCertificate = async () => {
    await actions.chooseCertificate.mutateAsync()
    if (isDemoMode) {
      await alert({
        title: t("credit-registration-demo-certificate-dialog-title"),
        message: t("credit-registration-demo-certificate-dialog-body"),
      })
      return
    }
    if (certificateConfigurationId) {
      router.push(certificateHref(courseModuleId, certificateConfigurationId))
    }
  }

  return (
    <div className={pageCss}>
      <VisuallyHidden elementType={HIDDEN_HEADING} tabIndex={-1}>
        {t("credit-registration-questions-heading")}
      </VisuallyHidden>
      <RadioGroup
        name={ROUTE_FIELD}
        control={control}
        variant={SEGMENTED}
        showCheckMark
        label={t("credit-registration-question-uh-student")}
        description={
          <>
            {t("credit-registration-question-uh-student-help")}
            <em className={answerHintCss}>
              {t("credit-registration-question-uh-student-answer-hint")}
            </em>
          </>
        }
      >
        <Radio value={UNIVERSITY_OF_HELSINKI} label={t("yes")} />
        <Radio value={OPEN_UNIVERSITY} label={t("no")} />
      </RadioGroup>

      {asksFinnishId ? (
        <RadioGroup
          name={HAS_FINNISH_ID_FIELD}
          control={control}
          variant={SEGMENTED}
          showCheckMark
          label={t("are-you-finnish-or-do-you-have-a-finnish-personal-identity-code")}
        >
          <Radio value={YES} label={t("yes")} />
          <Radio value={NO} label={t("no")} />
        </RadioGroup>
      ) : null}

      {asksNeed ? (
        <RadioGroup
          name={NEED_FIELD}
          control={control}
          variant={SEGMENTED}
          fillWidth
          showCheckMark
          label={t("which-do-you-need")}
          description={t("credits-in-uh-registry-are-useful-mainly-if-you-study-in-finland")}
          proseDescription
        >
          <Radio value={CERTIFICATE} label={t("a-certificate-of-completion")} />
          <Radio value={CREDITS} label={t("credits-in-the-uh-study-registry")} />
        </RadioGroup>
      ) : null}

      {asksIdentification ? (
        <RadioGroup
          name={IDENTIFICATION_FIELD}
          control={control}
          variant={SEGMENTED}
          fillWidth
          showCheckMark
          label={t("how-will-you-identify-yourself")}
          proseDescription
          description={
            <>
              <p>{t("enrollment-requires-strong-authentication-choose-how-you-identify")}</p>
              <p>
                <Trans
                  t={t}
                  i18nKey="eidas-explanation"
                  components={{
                    eidasLink: (
                      <TransLink
                        href={SUOMI_FI_EIDAS_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    ),
                  }}
                />
              </p>
              <p>
                <Trans
                  t={t}
                  i18nKey="other-suomi-fi-identification-methods-explanation"
                  components={{
                    suomiFiLink: (
                      <TransLink
                        href={SUOMI_FI_IDENTIFICATION_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    ),
                  }}
                />
              </p>
            </>
          }
        >
          <Radio value={EIDAS} label={t("credit-registration-identification-option-eidas")} />
          <Radio
            value={OTHER_SUOMI_FI}
            label={t("credit-registration-identification-option-finnish")}
          />
          <Radio value={NO_SUOMI_FI} label={t("no")} />
        </RadioGroup>
      ) : null}

      {asksIdentification && values[IDENTIFICATION_FIELD] === EIDAS ? (
        <p className={noteBoxCss}>{t("tip-in-sisu-choose-suomi-fi-e-identification-then-eidas")}</p>
      ) : null}
      {asksIdentification && values[IDENTIFICATION_FIELD] === OTHER_SUOMI_FI ? (
        <p className={noteBoxCss}>
          {t("tip-in-sisu-choose-suomi-fi-e-identification-then-your-method")}
        </p>
      ) : null}

      {asksToReconsider ? (
        <RadioGroup
          name={NEED_AFTER_RECONSIDER_FIELD}
          control={control}
          variant={SEGMENTED}
          fillWidth
          showCheckMark
          label={t("reconsider-which-do-you-need")}
          description={t("without-suomi-fi-identification-we-verify-your-identity-manually")}
          proseDescription
        >
          <Radio value={CERTIFICATE} label={t("a-certificate-of-completion")} />
          <Radio value={CREDITS} label={t("credits-in-the-uh-study-registry")} />
        </RadioGroup>
      ) : null}

      {asksWhyCreditsAreNeeded ? (
        <CreditJustificationForm
          courseModuleId={courseModuleId}
          savedJustification={creditJustification}
          saveLabel={t("credit-registration-button-save-reason")}
          onSaved={onJustificationSaved}
        />
      ) : null}

      {route === "open-university" && values[HAS_FINNISH_ID_FIELD] === YES && asksFinnishId ? (
        <div className={noteBoxCss}>
          <p className={noteTitleCss}>{t("credit-registration-please-register-heading")}</p>
          <p>
            <Trans
              t={t}
              i18nKey="credit-registration-please-register-body"
              components={{
                supportMail: <Link href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</Link>,
              }}
            />
          </p>
        </div>
      ) : null}

      {route === "certificate" ? (
        <div className={decisionCss} role="status">
          <div>
            <p className={decisionTextCss}>{t("credit-registration-decision-certificate")}</p>
            <p>{t("credit-registration-decision-certificate-body")}</p>
          </div>
          <Button
            variant={BUTTON_PRIMARY}
            size="large"
            className={fullWidthCss}
            isLoading={actions.chooseCertificate.isPending}
            onClick={() => void goToCertificate()}
          >
            {t("credit-registration-button-go-to-the-certificate")}
          </Button>
        </div>
      ) : route ? (
        <div className={decisionCss} role="status">
          <p className={decisionTextCss}>
            {route === "sisu"
              ? t("credit-registration-decision-sisu")
              : t("credit-registration-decision-open-university")}
          </p>
          <Button
            variant={BUTTON_PRIMARY}
            size="large"
            className={fullWidthCss}
            onClick={onContinue}
          >
            {t("credit-registration-button-continue-for-instructions")}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
