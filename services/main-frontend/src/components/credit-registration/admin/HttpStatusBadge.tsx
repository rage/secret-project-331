"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/shared-module/components"

import { CREDIT_REGISTRATION_NS, TONE } from "../constants"
import { codeValueCss } from "../styles"

interface Props {
  httpStatus: number | null | undefined
  succeeded: boolean
}

/** A clean 200 is what most rows are, so it reads as the log's ordinary ink. */
const plainStatusCss = css`
  color: var(--color-gray-500);
`

/**
 * Whether one study registry call itself went through. Item-level rejections are the item count
 * columns' business: a 200 that rejected items still delivered its answer.
 *
 * Only a failed request gets a badge. A filled green pill on every successful row is the whole
 * column, which ranks nothing and buries the handful of calls that did fail.
 */
const HttpStatusBadge: React.FC<Props> = ({ httpStatus, succeeded }) => {
  const { t } = useTranslation(CREDIT_REGISTRATION_NS)
  const label =
    httpStatus === null || httpStatus === undefined
      ? t("credit-registration-admin-no-http-answer")
      : String(httpStatus)

  if (succeeded) {
    return <span className={cx(codeValueCss, plainStatusCss)}>{label}</span>
  }
  return (
    <Badge tone={TONE.DANGER} size="compact">
      {label}
    </Badge>
  )
}

export default HttpStatusBadge
