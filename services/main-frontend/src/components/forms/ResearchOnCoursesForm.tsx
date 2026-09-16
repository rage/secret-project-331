"use client"

import { css } from "@emotion/css"
import { useQueryClient } from "@tanstack/react-query"
import React, { useState } from "react"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { createUserResearchConsent } from "@/generated/api/sdk.generated"
import type { UserResearchConsent } from "@/generated/api/types.generated"
import { refetchUserResearchConsent } from "@/hooks/useUserResearchConsentQuery"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { Dialog, Radio, RadioGroup } from "@/shared-module/components"

interface ResearchOnCoursesFormProps {
  afterSubmit?: () => void
  initialConsentValue?: boolean
}

interface ResearchConsentFields {
  consent: string
}

// oxlint-disable-next-line i18next/no-literal-string
const CONSENT_GIVEN = "given"
// oxlint-disable-next-line i18next/no-literal-string
const CONSENT_DECLINED = "declined"

const toConsentOption = (consent: boolean | undefined): string => {
  if (consent === undefined) {
    return ""
  }
  return consent ? CONSENT_GIVEN : CONSENT_DECLINED
}

const bodyCss = css`
  display: grid;
  gap: var(--space-4);
  line-height: 1.5;

  ol {
    display: grid;
    gap: var(--space-2);
    margin: 0;
    padding-left: var(--space-4-5);
  }
`

const contactLinkCss = css`
  color: var(--link-fg);
  text-decoration: underline;
`

const ResearchOnCoursesForm: React.FC<React.PropsWithChildren<ResearchOnCoursesFormProps>> = ({
  afterSubmit,
  initialConsentValue,
}) => {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [researchConsentFormOpen, setResearchConsentFormOpen] = useState(true)
  const { control, watch } = useForm<ResearchConsentFields>({
    defaultValues: { consent: toConsentOption(initialConsentValue) },
  })
  const consent = watch("consent")

  const consentQuery = useToastMutation<UserResearchConsent, unknown, void>(
    // oxlint-disable-next-line require-await -- async for the mutation Promise contract
    async () =>
      createUserResearchConsent({
        body: {
          consent: consent === CONSENT_GIVEN,
        },
      }),
    {
      notify: true,
      method: "POST",
    },
    {
      onSuccess: async () => {
        await refetchUserResearchConsent(queryClient)
      },
    },
  )

  const handleOnSubmit = () => {
    setResearchConsentFormOpen(false)
    consentQuery.mutate()
    if (afterSubmit !== undefined) {
      afterSubmit()
    }
  }

  return (
    <Dialog
      open={researchConsentFormOpen}
      // Consent must be an explicit choice: no close button, and closing on Escape is a no-op.
      onClose={() => {}}
      showCloseButton={false}
      title={t("research-consent-title")}
      data-testid="research-consent-dialog"
      actions={[
        {
          variant: "primary",
          onClick: handleOnSubmit,
          disabled: !consent,
          label: t("button-text-save"),
        },
      ]}
    >
      <div className={bodyCss}>
        <p>{t("research-consent-educational-research-is-conducted-on-the-courses")}</p>
        <ol>
          <li>{t("research-consent-goals-develop-learning")}</li>
          <li>{t("research-consent-goals-advance-knowledge")}</li>
          <li>{t("research-consent-goals-provide-research-based-support")}</li>
        </ol>
        <p>{t("research-consent-data-from-learning-process-is-used")}</p>
        <p>
          {t("research-consent-responsible")}
          {/* oxlint-disable-next-line next/no-html-link-for-pages -- external email address, not an internal route */}
          <a className={contactLinkCss} href="mailto:mooc@cs.helsinki.fi">
            {/* oxlint-disable-next-line i18next/no-literal-string */}
            mooc@cs.helsinki.fi
          </a>
          .
        </p>
        <RadioGroup name="consent" control={control} label={t("title-general-research-consent")}>
          <Radio
            value={CONSENT_GIVEN}
            label={t("research-consent-i-want-to-participate-in-educational-research")}
          />
          <Radio
            value={CONSENT_DECLINED}
            label={t("research-consent-i-do-not-want-participate-in-educational-research")}
          />
        </RadioGroup>
      </div>
    </Dialog>
  )
}

export default ResearchOnCoursesForm
