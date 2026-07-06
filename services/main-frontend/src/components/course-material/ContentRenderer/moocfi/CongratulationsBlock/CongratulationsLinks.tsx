"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import type { UserModuleCompletionStatus } from "@/generated/course-material-api/types.generated"
import Button from "@/shared-module/common/components/Button"
import { Link } from "@/shared-module/components"

const COMPLETION_REGISTRATION_BASE_PATH = `/completion-registration`
const GENERATE_CERTIFICATE_BASE_PATH = `/generate-certificate`

const CTAWrapper = styled.div`
  margin-top: 2rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
`

const StyledLink = styled.a`
  padding: 1rem;
  font-size: 18px;
  line-height: 1.1;
  color: #044743 !important;
  text-decoration: underline;
`

/**
 * A single interactive element per CTA (no anchor wrapping a button, no
 * overriding aria-label): an enabled link styled as a button when the module is
 * completed, or a disabled button (non-navigable) otherwise. The visible label
 * is the accessible name (WCAG 1.3.1, 2.5.3).
 */
const Cta: React.FC<{ href: string; label: string; enabled: boolean }> = ({
  href,
  label,
  enabled,
}) =>
  enabled ? (
    <Link href={href} styledAsButton variant="tertiary" size="large">
      {label}
    </Link>
  ) : (
    <Button variant="tertiary" size="large" disabled>
      {label}
    </Button>
  )

export interface CongratulationsLinksProps {
  certificateConfigurationId: string | null | undefined
  module: UserModuleCompletionStatus
}

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
        button:disabled {
          color: #91ac97 !important;
        }
      `}
    >
      {module.enable_registering_completion_to_uh_open_university && (
        <Cta
          href={`${COMPLETION_REGISTRATION_BASE_PATH}/${module.module_id}`}
          label={t("register")}
          enabled={Boolean(module.completed)}
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
