"use client"

import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { isAppApiError } from "@/shared-module/common/errors/AppApiError"
import { Infobox } from "@/shared-module/components"

const TOO_MANY_REQUESTS = 429
const WARNING_TONE = "warning" as const
const MILLISECONDS_PER_SECOND = 1000
const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" }

/** Whether an account form request was refused for too many attempts from the network. */
export function isTooManyAttempts(error: unknown): boolean {
  return isAppApiError(error) && error.status === TOO_MANY_REQUESTS
}

/** Tells the user to wait before trying an account form again; shown for [`isTooManyAttempts`]. */
const TooManyAttemptsNotice: React.FC<{ error: unknown }> = ({ error }) => {
  const { t, i18n } = useTranslation()
  // Computed once per error so that rerenders do not move the deadline.
  const time = useMemo(() => {
    const retryAfterSeconds = isAppApiError(error) ? error.retryAfterSeconds : null
    return retryAfterSeconds !== null && retryAfterSeconds > 0
      ? new Date(Date.now() + retryAfterSeconds * MILLISECONDS_PER_SECOND).toLocaleTimeString(
          i18n.language,
          TIME_FORMAT,
        )
      : null
  }, [error, i18n.language])
  return (
    <Infobox tone={WARNING_TONE} heading={t("too-many-attempts-heading")} announce>
      {time === null
        ? t("too-many-attempts-from-network")
        : t("too-many-attempts-from-network-try-at", { time })}
    </Infobox>
  )
}

export default TooManyAttemptsNotice
