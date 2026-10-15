"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { formatDuration } from "@/utils/moduleTimeline"

export interface DurationProps {
  seconds: number
}

/** Renders a duration in seconds as a localized, day-aware string ("Xd", "Xh Ym", "Ym"). */
const Duration: React.FC<DurationProps> = ({ seconds }) => {
  const { t } = useTranslation()
  return <span>{formatDuration(seconds, t)}</span>
}

export default Duration
