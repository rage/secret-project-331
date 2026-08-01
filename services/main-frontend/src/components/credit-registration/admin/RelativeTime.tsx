"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { humanReadableDateTime, relativeTimeFromTimestamp } from "@/shared-module/common/utils/time"

interface Props {
  at: string | null | undefined
}

const ABSENT = "-"

/**
 * "3 minutes ago", with the exact instant in the tooltip.
 *
 * Relative time is the unit of ops reasoning; the absolute one is the unit of bug reports, so both are
 * always available on every timestamp in this dashboard.
 */
const RelativeTime: React.FC<Props> = ({ at }) => {
  const { i18n } = useTranslation()
  if (!at) {
    return <span>{ABSENT}</span>
  }
  return (
    <time title={humanReadableDateTime(at, i18n.language) ?? at}>
      {relativeTimeFromTimestamp(at)}
    </time>
  )
}

export default RelativeTime
