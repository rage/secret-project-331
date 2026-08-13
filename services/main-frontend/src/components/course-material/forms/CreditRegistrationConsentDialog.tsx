"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { MyCourseCreditRegistrationConsent } from "@/generated/api/types.generated"
import { useSetCreditRegistrationConsent } from "@/hooks/course-material/useCourseCreditRegistrationConsent"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
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
  const ects = sumEcts(consent)
  const existingCompletions = consent.registrable_completion_count
  const modulesRegisterSeparately = consent.modules.length > 1

  const answer = useSetCreditRegistrationConsent({ notify: false })

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
            onClick={() =>
              answer.mutate(
                { courseId: consent.course_id, consentGiven: false },
                { onSuccess: onClose },
              )
            }
            data-testid="credit-registration-consent-decline-button"
          >
            {t("credit-registration-consent-decline")}
          </Button>
          <Button
            variant="primary"
            size="medium"
            disabled={answer.isPending}
            onClick={() =>
              answer.mutate(
                { courseId: consent.course_id, consentGiven: true },
                { onSuccess: onClose },
              )
            }
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
