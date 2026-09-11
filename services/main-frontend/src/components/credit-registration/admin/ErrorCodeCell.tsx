"use client"

import { cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import type { CreditRegistrationErrorCode } from "@/generated/api/types.generated"

import { CREDIT_REGISTRATION_NS } from "../constants"
import { registrationErrorShortLabel } from "../creditRegistrationCopy"
import { monospaceCss, noteCss, stackedCellCss } from "../styles"

/**
 * One failure as a table cell: the short reason first, the wire code under it.
 *
 * The code alone is what an operator quotes to support, and what nobody else can read; both are
 * needed, in that order. For the full sentence use `registrationErrorAdminHelp`.
 */
const ErrorCodeCell: React.FC<{ errorCode: CreditRegistrationErrorCode }> = ({ errorCode }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  return (
    <span className={stackedCellCss}>
      <span>{registrationErrorShortLabel(t, errorCode)}</span>
      <code className={cx(noteCss, monospaceCss)}>{errorCode}</code>
    </span>
  )
}

export default ErrorCodeCell
