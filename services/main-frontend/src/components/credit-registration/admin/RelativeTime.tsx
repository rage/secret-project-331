"use client"

import { formatDistanceToNow } from "date-fns"
import React from "react"
import { useTranslation } from "react-i18next"

import { humanReadableDateTime } from "@/shared-module/common/utils/time"

interface Props {
  at: string | null | undefined
}

export const ABSENT = "—"

const RelativeTime: React.FC<Props> = ({ at }) => {
  const { i18n } = useTranslation()
  if (!at) {
    return <span>{ABSENT}</span>
  }
  return (
    <time title={humanReadableDateTime(at, i18n.language) ?? at}>
      {formatDistanceToNow(new Date(at), { addSuffix: true })}
    </time>
  )
}

export default RelativeTime
