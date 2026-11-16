"use client"

import { css } from "@emotion/css"
import React, { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

const visuallyHiddenClass = css`
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
`

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
    // Crossed thresholds are all marked so an earlier one never fires late.
    const crossed = THRESHOLDS_SECONDS.filter((threshold) => secondsLeft <= threshold)
    if (crossed.every((threshold) => announced.current.has(threshold))) {
      return
    }
    crossed.forEach((threshold) => announced.current.add(threshold))
    setMessage(`${t("time-left")} ${t("minutes", { count: Math.ceil(secondsLeft / 60) })}`)
  }, [secondsLeft, t])

  return (
    <div role="status" className={visuallyHiddenClass}>
      {message}
    </div>
  )
}

export default ExamStatusAnnouncer
