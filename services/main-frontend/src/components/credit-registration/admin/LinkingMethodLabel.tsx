"use client"

import { css } from "@emotion/css"
import { BuildingColumn, EnvelopeCheck, UserGear } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import type { StudentNumberVerificationMethod } from "@/generated/api/types.generated"
import { Tooltip } from "@/shared-module/components"

import { CREDIT_REGISTRATION_NS } from "../constants"
import { noteCss, subheadingCss } from "../styles"
import { formatZonedTimestamp } from "../ZonedTimestamp"
import { verificationMethodLabel } from "./adminCreditRegistrationCopy"

const ICON_SIZE = 16

const METHOD_ICONS = {
  emailed_link: EnvelopeCheck,
  admin_manual: UserGear,
  study_registry: BuildingColumn,
} as const satisfies Record<StudentNumberVerificationMethod, unknown>

const METHOD_DESCRIPTION_KEYS = {
  emailed_link: "credit-registration-admin-linking-method-emailed-link-description",
  admin_manual: "credit-registration-admin-linking-method-admin-manual-description",
  study_registry: "credit-registration-admin-linking-method-study-registry-description",
} as const satisfies Record<StudentNumberVerificationMethod, string>

const triggerCss = css`
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 400;
  white-space: nowrap;
`

const contentCss = css`
  display: grid;
  gap: var(--space-1);
`

/** How a student number was linked, as an icon and a label that explain more on hover, press or Enter. */
const LinkingMethodLabel: React.FC<{
  method: StudentNumberVerificationMethod
  linkedAt: string | null | undefined
}> = ({ method, linkedAt }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const Icon = METHOD_ICONS[method]
  const label = verificationMethodLabel(t, method)
  return (
    <Tooltip
      aria-label={t("credit-registration-admin-linking-method-label", { method: label })}
      trigger={
        <span className={triggerCss}>
          <Icon size={ICON_SIZE} />
          {label}
        </span>
      }
    >
      <span className={contentCss}>
        <span className={subheadingCss}>{label}</span>
        <span>{t(METHOD_DESCRIPTION_KEYS[method])}</span>
        {linkedAt && <span className={noteCss}>{formatZonedTimestamp(new Date(linkedAt))}</span>}
      </span>
    </Tooltip>
  )
}

export default LinkingMethodLabel
