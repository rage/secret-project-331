"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import type { UserModuleCompletionStatus } from "@/generated/course-material-api/types.generated"
import { Button, Link } from "@/shared-module/components"

const COMPLETION_REGISTRATION_BASE_PATH = `/completion-registration`
const GENERATE_CERTIFICATE_BASE_PATH = `/generate-certificate`

const CTAWrapper = styled.div`
  margin-top: 2rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;

  /* Override ContentRenderer's blue link color; needs contrast against the green card. */
  a:not(:hover):not(:focus-visible) {
    color: #04312e;
  }
`

const StyledLink = styled.a`
  padding: 1rem;
  font-size: 18px;
  line-height: 1.1;
  color: #044743 !important;
  text-decoration: underline;
`

// One interactive element per CTA, not an anchor wrapping a button (WCAG 1.3.1, 2.5.3).
// A disabled CTA with a `hint` stays focusable and is described by it.
const Cta: React.FC<{ href: string; label: string; enabled: boolean; hint?: string }> = ({
  href,
  label,
  enabled,
  hint,
}) => {
  if (enabled) {
    return (
      <Link href={href} styledAsButton variant="secondary" size="large">
        {label}
      </Link>
    )
  }
  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
      `}
    >
      <Button variant="secondary" size="large" disabled={!hint} disabledReason={hint}>
        {label}
      </Button>
      {hint && (
        // The button carries the hint as its description.
        <span aria-hidden="true" className={css(`font-size: 16px; color: #04312e;`)}>
          {hint}
        </span>
      )}
    </div>
  )
}

export interface CongratulationsLinksProps {
  certificateConfigurationId: string | null | undefined
  module: UserModuleCompletionStatus
}

export const moduleOffersCreditOrCompletionRegistration = (
  module: UserModuleCompletionStatus,
): boolean => module.registers_credits

const CongratulationsLinks: React.FC<React.PropsWithChildren<CongratulationsLinksProps>> = ({
  certificateConfigurationId,
  module,
}) => {
  const { t } = useTranslation()
  const isReady = false
  if (module.grade === 0 || module.passed === false) {
    return null
  }

  return (
    <CTAWrapper
      className={css`
        button:disabled,
        button[aria-disabled="true"] {
          color: #91ac97 !important;
        }
      `}
    >
      {moduleOffersCreditOrCompletionRegistration(module) && (
        <Cta
          href={`${COMPLETION_REGISTRATION_BASE_PATH}/${module.module_id}`}
          label={module.register_credits_via_suotar ? t("register-completion") : t("register")}
          enabled={Boolean(module.completed)}
          hint={t("credit-registration-registers-on-module-completion")}
        />
      )}
      {module.certification_enabled && certificateConfigurationId && (
        <Cta
          href={`${GENERATE_CERTIFICATE_BASE_PATH}?module=${module.module_id}&ccid=${certificateConfigurationId}`}
          label={t("generate-certificate-button-label")}
          enabled={Boolean(module.completed)}
        />
      )}
      {isReady && <StyledLink>{t("generate-certicate")}</StyledLink>}
    </CTAWrapper>
  )
}

export default CongratulationsLinks
