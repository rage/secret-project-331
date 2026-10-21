"use client"

import { css } from "@emotion/css"
import React from "react"
import { useTranslation } from "react-i18next"

import AbsentValue from "./AbsentValue"
import { CREDIT_REGISTRATION_NS } from "./constants"
import { formatFutureInWords } from "./durationWords"
import { formatZonedTimestamp } from "./ZonedTimestamp"

const nowrapCss = css`
  white-space: nowrap;
`

/**
 * When something is scheduled to happen, in words relative to now ("in 5 minutes", "tomorrow"),
 * with the full timestamp in the tooltip. A time already passed reads "Due now", never "ago": the
 * thing is late, not done. Past events take `ZonedTimestamp`.
 */
const ScheduledTime: React.FC<{ at: string | null | undefined }> = ({ at }) => {
  const { t, i18n } = useTranslation(CREDIT_REGISTRATION_NS)
  if (!at) {
    return <AbsentValue />
  }
  const date = new Date(at)
  return (
    <time className={nowrapCss} dateTime={at} title={formatZonedTimestamp(date)}>
      {date.getTime() <= Date.now()
        ? t("credit-registration-due-now")
        : formatFutureInWords(date, i18n.language)}
    </time>
  )
}

export default ScheduledTime
