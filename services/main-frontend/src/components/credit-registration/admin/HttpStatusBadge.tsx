"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/shared-module/components"

import { TONE } from "../constants"

interface Props {
  httpStatus: number | null | undefined
  succeeded: boolean
  /** Items the study registry rejected inside a call that itself came back 200. */
  errorItemCount?: number
}

/**
 * One study registry call's outcome. A 200 that rejected every item is not a success in the sense
 * an operator scanning the column cares about, so the item outcome tones the badge too.
 */
const HttpStatusBadge: React.FC<Props> = ({ httpStatus, succeeded, errorItemCount = 0 }) => {
  const { t } = useTranslation()
  const tone = !succeeded ? TONE.DANGER : errorItemCount > 0 ? TONE.WARNING : TONE.SUCCESS
  return (
    <Badge tone={tone} size="compact">
      {httpStatus === null || httpStatus === undefined
        ? t("credit-registration-admin-no-http-answer")
        : String(httpStatus)}
    </Badge>
  )
}

export default HttpStatusBadge
