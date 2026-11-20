"use client"

import { announce } from "@react-aria/live-announcer"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

const THRESHOLDS_SECONDS = [10 * 60, 60]

/** Announces "exam started" once, and the time left at 10 and 1 minute. */
export default function useExamStatusAnnouncer(
  secondsLeft: number | null,
  announceStarted: boolean,
) {
  const { t } = useTranslation()
  const announced = useRef(new Set<number>())
  const startedAnnounced = useRef(false)

  useEffect(() => {
    if (announceStarted && !startedAnnounced.current) {
      startedAnnounced.current = true
      // oxlint-disable-next-line i18next/no-literal-string -- ARIA politeness level, not user copy
      announce(t("exam-started"), "polite")
    }
  }, [announceStarted, t])

  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) {
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
    announce(
      `${t("time-left")} ${t("minutes", { count: Math.ceil(secondsLeft / 60) })}`,
      // oxlint-disable-next-line i18next/no-literal-string -- ARIA politeness level, not user copy
      "polite",
    )
  }, [secondsLeft, t])
}
