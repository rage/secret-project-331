"use client"

import React, { useEffect, useRef, useState } from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

const THRESHOLDS_SECONDS = [10 * 60, 60]

export interface ExamStatusAnnouncerProps {
  secondsLeft: number
  announceStarted: boolean
}

/** Always-mounted status region: speaks "exam started" once, and the time left at 10 and 1 minute. */
const ExamStatusAnnouncer: React.FC<ExamStatusAnnouncerProps> = ({
  secondsLeft,
  announceStarted,
}) => {
  const { t } = useTranslation()
  const [message, setMessage] = useState("")
  const announced = useRef(new Set<number>())
  const startedAnnounced = useRef(false)

  useEffect(() => {
    if (announceStarted && !startedAnnounced.current) {
      startedAnnounced.current = true
      setMessage(t("exam-started"))
    }
  }, [announceStarted, t])

  useEffect(() => {
    if (secondsLeft <= 0) {
      return
    }
    // Re-arm thresholds the time is back above, e.g. once the clock skew estimate arrives.
    THRESHOLDS_SECONDS.forEach((threshold) => {
      if (secondsLeft > threshold) {
        announced.current.delete(threshold)
      }
    })
    // Crossed thresholds are all marked so an earlier one never fires late.
    const crossed = THRESHOLDS_SECONDS.filter((threshold) => secondsLeft <= threshold)
    if (crossed.every((threshold) => announced.current.has(threshold))) {
      return
    }
    crossed.forEach((threshold) => announced.current.add(threshold))
    setMessage(`${t("time-left")} ${t("minutes", { count: Math.ceil(secondsLeft / 60) })}`)
  }, [secondsLeft, t])

  return (
    <VisuallyHidden>
      <div role="status">{message}</div>
    </VisuallyHidden>
  )
}

export default ExamStatusAnnouncer
