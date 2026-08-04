"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import {
  getMyCourseCreditRegistrationConsentQueryKey,
  getMyCreditRegistrationConsentsQueryKey,
  getMyCreditRegistrationsQueryKey,
} from "@/generated/api/@tanstack/react-query.generated"
import { setMyCourseCreditRegistrationConsent } from "@/generated/api/sdk.generated"
import type {
  MyCourseCreditRegistrationConsent,
  SetMyCourseCreditRegistrationConsentResult,
} from "@/generated/api/types.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button, Dialog } from "@/shared-module/components"

export interface CreditRegistrationConsentDialogProps {
  consent: MyCourseCreditRegistrationConsent
  onClose: () => void
}

const bodyCss = css`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  line-height: 1.55;

  p {
    margin: 0;
  }
`

const footnoteCss = css`
  color: var(--color-gray-600);
  font-size: var(--font-size-1);
`

const buttonsCss = css`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.5rem;
`

const sumEcts = (consent: MyCourseCreditRegistrationConsent): number =>
  consent.modules.reduce((total, module) => total + (module.ects_credits ?? 0), 0)

/** A decline is recorded rather than ignored, so it is not asked again. */
const CreditRegistrationConsentDialog: React.FC<CreditRegistrationConsentDialogProps> = ({
  consent,
  onClose,
}) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const ects = sumEcts(consent)
  const existingCompletions = consent.registrable_completion_count
  const modulesRegisterSeparately = consent.modules.length > 1

  const answer = useToastMutation<SetMyCourseCreditRegistrationConsentResult, unknown, boolean>(
    async (consentGiven) =>
      await setMyCourseCreditRegistrationConsent({
        path: { course_id: consent.course_id },
        body: { consent_given: consentGiven },
      }),
    { notify: false },
    {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: getMyCourseCreditRegistrationConsentQueryKey({
              path: { course_id: consent.course_id },
            }),
          }),
          queryClient.invalidateQueries({ queryKey: getMyCreditRegistrationsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getMyCreditRegistrationConsentsQueryKey() }),
        ])
        onClose()
      },
    },
  )

  return (
    <Dialog
      open={true}
      // No dismissal path: the student has to accept or decline.
      onClose={() => {}}
      title={t("credit-registration-consent-title")}
      showCloseButton={false}
    >
      <div className={bodyCss}>
        {answer.isError && <ErrorBanner variant={"readOnly"} error={answer.error} />}
        <p>{t("credit-registration-consent-what-happens", { ects })}</p>
        <p>{t("credit-registration-consent-what-we-need")}</p>
        <p>{t("credit-registration-consent-what-we-send")}</p>
        {modulesRegisterSeparately && (
          <p>{t("credit-registration-consent-separate-attainments")}</p>
        )}
        {existingCompletions > 0 && (
          <p>
            {t("credit-registration-consent-existing-completions", { count: existingCompletions })}
          </p>
        )}
        <p className={footnoteCss}>{t("credit-registration-consent-changeable-later")}</p>
        <div className={buttonsCss}>
          <Button
            variant="secondary"
            size="medium"
            disabled={answer.isPending}
            onClick={() => answer.mutate(false)}
            data-testid="credit-registration-consent-decline-button"
          >
            {t("credit-registration-consent-decline")}
          </Button>
          <Button
            variant="primary"
            size="medium"
            disabled={answer.isPending}
            onClick={() => answer.mutate(true)}
            data-testid="credit-registration-consent-accept-button"
          >
            {t("credit-registration-consent-accept")}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

export default withErrorBoundary(CreditRegistrationConsentDialog)
