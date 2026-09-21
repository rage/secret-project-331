"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { BADGE_COMPACT, MIDDLE_DOT, TONE } from "@/components/credit-registration/constants"
import { noteCss } from "@/components/credit-registration/styles"
import type { CourseCreditRegistrationModuleSummary } from "@/generated/api/types.generated"
import { Badge, Link } from "@/shared-module/components"

interface Props {
  summary: CourseCreditRegistrationModuleSummary
  /** The roster listing this module's registrations, optionally narrowed to its failed ones. */
  rosterHrefOf: (failed?: boolean) => string
}

const lineCss = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
`

const failedCss = css`
  color: var(--color-crimson-700);
`

/**
 * What a module's credit registration has actually done, on the page where it is configured.
 *
 * Renders nothing for a module that registers no credits or has no registrations yet.
 */
const ModuleRegistrationStatus: React.FC<Props> = ({ summary, rosterHrefOf }) => {
  const { t } = useTranslation()
  if (!summary.enabled || summary.registration_count === 0) {
    return null
  }

  return (
    <p className={cx(noteCss, lineCss)}>
      <Link href={rosterHrefOf()}>
        {t("credit-registration-summary-registered", {
          registered: summary.registered_count,
          total: summary.registration_count,
        })}
      </Link>
      {summary.failed_count > 0 && (
        <>
          {MIDDLE_DOT}
          <Link href={rosterHrefOf(true)} className={failedCss}>
            {t("credit-registration-summary-failed", { count: summary.failed_count })}
          </Link>
        </>
      )}
      {summary.paused && (
        <Badge tone={TONE.NEUTRAL} size={BADGE_COMPACT}>
          {t("credit-registration-module-paused-by-support")}
        </Badge>
      )}
    </p>
  )
}

export default ModuleRegistrationStatus
