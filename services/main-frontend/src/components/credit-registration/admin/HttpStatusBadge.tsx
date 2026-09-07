"use client"

import { css, cx } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/shared-module/components"

import { TONE } from "../constants"
import { monospaceCss } from "../styles"

interface Props {
  httpStatus: number | null | undefined
  succeeded: boolean
  /** Items the study registry rejected inside a call that itself came back 200. */
  errorItemCount?: number
}

/** A clean 200 is what most rows are, so it reads as the log's ordinary ink. */
const plainStatusCss = css`
  color: var(--color-gray-500);
`

/**
 * One study registry call's outcome. A 200 that rejected every item is not a success in the sense
 * an operator scanning the column cares about, so the item outcome decides the treatment too.
 *
 * Only a call worth stopping on gets a badge. A filled green pill on every successful row is the
 * whole column, which ranks nothing and buries the handful of calls that did fail.
 */
const HttpStatusBadge: React.FC<Props> = ({ httpStatus, succeeded, errorItemCount = 0 }) => {
  const { t } = useTranslation()
  const label =
    httpStatus === null || httpStatus === undefined
      ? t("credit-registration-admin-no-http-answer")
      : String(httpStatus)

  if (succeeded && errorItemCount === 0) {
    return <span className={cx(monospaceCss, plainStatusCss)}>{label}</span>
  }
  return (
    <Badge tone={succeeded ? TONE.WARNING : TONE.DANGER} size="compact">
      {label}
    </Badge>
  )
}

export default HttpStatusBadge
