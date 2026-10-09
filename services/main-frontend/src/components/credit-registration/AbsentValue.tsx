"use client"

import { css } from "@emotion/css"
import { MinusCircle } from "@vectopus/atlas-icons-react"
import React from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import { CREDIT_REGISTRATION_NS } from "./constants"

const ICON_SIZE = 14

const iconCss = css`
  display: inline-flex;
  vertical-align: middle;
  color: var(--color-gray-300);
`

/** Stands in for a value that does not exist: a muted mark, read out as "None". */
const AbsentValue: React.FC = () => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <span className={iconCss}>
      <MinusCircle size={ICON_SIZE} aria-hidden />
      <VisuallyHidden>{t("credit-registration-value-none")}</VisuallyHidden>
    </span>
  )
}

export default AbsentValue
